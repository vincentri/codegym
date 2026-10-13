//! Talks to the AI provider a profile points at. Two wire formats cover every preset:
//! - OpenAI-compatible chat completions: Ollama, OpenCode Zen, LM Studio, OpenRouter, …
//! - the Anthropic Messages API: Claude.
//!
//! Replies stream as Server-Sent Events, are forwarded as text deltas, and can be cancelled.

mod anthropic;
pub mod draft;
#[cfg(any(test, feature = "testing"))]
pub mod mock_server;
mod openai;
pub mod prompts;
pub mod secrets;
mod sse;

use std::time::Duration;

use futures_util::StreamExt;
use tokio_util::sync::CancellationToken;

#[cfg(feature = "keychain")]
pub use secrets::KeyringStore;
pub use secrets::{FileStore, MemoryStore, SecretStore};
pub use tokio_util::sync::CancellationToken as Cancel;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Wire {
    OpenAi,
    Anthropic,
}

/// Everything needed to call a provider: a profile plus its key from the keychain.
#[derive(Debug, Clone)]
pub struct ProviderConfig {
    pub wire: Wire,
    pub base_url: String,
    pub api_key: Option<String>,
    pub model: String,
    /// low, medium or high.
    pub effort: String,
}

impl ProviderConfig {
    /// `provider` is the profile's kind: ollama, opencode_zen, anthropic or custom.
    pub fn new(provider: &str, base_url: &str, model: &str, effort: &str, api_key: Option<String>) -> Self {
        Self {
            wire: if provider == "anthropic" { Wire::Anthropic } else { Wire::OpenAi },
            base_url: base_url.trim().trim_end_matches('/').to_string(),
            api_key: api_key.filter(|k| !k.trim().is_empty()),
            model: model.trim().to_string(),
            effort: effort.to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Turn {
    pub role: Role,
    pub content: String,
}

impl Turn {
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: Role::User, content: content.into() }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: Role::Assistant, content: content.into() }
    }
}

#[derive(Debug, Clone)]
pub struct ChatRequest<'a> {
    pub system: &'a str,
    pub turns: &'a [Turn],
    pub max_tokens: u32,
}

/// What a streaming reply reports as it goes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ChatEvent {
    Delta(String),
    /// Discard the text so far: the model declined and a fallback model starts over.
    Reset,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatOutcome {
    pub text: String,
    /// The reply hit the output limit before it finished.
    pub truncated: bool,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AiError {
    #[error("Can't reach {0}. Check the URL{1}.")]
    Unreachable(String, &'static str),
    #[error("The provider rejected the API key ({0}). Check the key in Settings → AI Mentor.")]
    Unauthorized(String),
    #[error("Not found: {0}. Check the base URL and the model name.")]
    NotFound(String),
    #[error("The provider is rate limiting requests. Wait a moment and try again.")]
    RateLimited,
    #[error("The provider returned an error ({status}): {message}")]
    Http { status: u16, message: String },
    #[error("The model declined to answer{}.", .0.as_deref().map(|c| format!(" (category: {c})")).unwrap_or_default())]
    Refused(Option<String>),
    #[error("The provider took too long to answer.")]
    Timeout,
    #[error("Unexpected reply from the provider: {0}")]
    Protocol(String),
    #[error("Stopped.")]
    Cancelled,
}

/// Shared HTTP client. Cheap to clone.
#[derive(Debug, Clone)]
pub struct AiClient {
    http: reqwest::Client,
}

impl Default for AiClient {
    fn default() -> Self {
        Self::new()
    }
}

impl AiClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(600))
            .user_agent(concat!("CodeGym/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("HTTP client");
        Self { http }
    }

    /// The model ids the provider offers.
    pub async fn list_models(&self, cfg: &ProviderConfig) -> Result<Vec<String>, AiError> {
        let req = match cfg.wire {
            Wire::OpenAi => openai::models_request(&self.http, cfg),
            Wire::Anthropic => anthropic::models_request(&self.http, cfg),
        };
        let resp = send(req, cfg, &CancellationToken::new()).await?;
        let body: serde_json::Value = resp.json().await.map_err(|e| AiError::Protocol(e.to_string()))?;
        let mut ids: Vec<String> = body
            .get("data")
            .or_else(|| body.get("models"))
            .and_then(|d| d.as_array())
            .ok_or_else(|| AiError::Protocol("no model list in the reply".into()))?
            .iter()
            .filter_map(|m| m.get("id").or_else(|| m.get("name")).and_then(|v| v.as_str()).map(str::to_string))
            .collect();
        ids.sort();
        ids.dedup();
        Ok(ids)
    }

    /// Streams a reply, calling `on_event` for each piece of text.
    pub async fn chat(
        &self,
        cfg: &ProviderConfig,
        req: &ChatRequest<'_>,
        on_event: &mut (dyn FnMut(ChatEvent) + Send),
        cancel: &CancellationToken,
    ) -> Result<ChatOutcome, AiError> {
        let http_req = match cfg.wire {
            Wire::OpenAi => openai::chat_request(&self.http, cfg, req),
            Wire::Anthropic => anthropic::chat_request(&self.http, cfg, req),
        };
        let resp = send(http_req, cfg, cancel).await?;
        let mut parser = sse::SseParser::default();
        let mut state = StreamState::default();
        let mut body = resp.bytes_stream();
        loop {
            let chunk = tokio::select! {
                chunk = body.next() => chunk,
                _ = cancel.cancelled() => return Err(AiError::Cancelled),
            };
            match chunk {
                None => break,
                Some(Err(e)) if e.is_timeout() => return Err(AiError::Timeout),
                Some(Err(e)) => return Err(AiError::Protocol(e.to_string())),
                Some(Ok(bytes)) => {
                    for event in parser.feed(&bytes) {
                        if handle(cfg.wire, &event, &mut state, on_event)? {
                            return state.finish();
                        }
                    }
                }
            }
        }
        if let Some(event) = parser.finish() {
            handle(cfg.wire, &event, &mut state, on_event)?;
        }
        state.finish()
    }
}

/// Progress of one streamed reply.
#[derive(Debug, Default)]
pub(crate) struct StreamState {
    pub text: String,
    pub truncated: bool,
    pub refused: Option<Option<String>>,
}

impl StreamState {
    pub fn push(&mut self, text: &str, on_event: &mut (dyn FnMut(ChatEvent) + Send)) {
        if !text.is_empty() {
            self.text.push_str(text);
            on_event(ChatEvent::Delta(text.to_string()));
        }
    }

    fn finish(self) -> Result<ChatOutcome, AiError> {
        if let Some(category) = self.refused {
            return Err(AiError::Refused(category));
        }
        Ok(ChatOutcome { text: self.text, truncated: self.truncated })
    }
}

/// Applies one SSE event; returns true when the reply is complete.
fn handle(
    wire: Wire,
    event: &sse::SseEvent,
    state: &mut StreamState,
    on_event: &mut (dyn FnMut(ChatEvent) + Send),
) -> Result<bool, AiError> {
    match wire {
        Wire::OpenAi => openai::handle_event(event, state, on_event),
        Wire::Anthropic => anthropic::handle_event(event, state, on_event),
    }
}

/// Sends a request and turns failures into messages people can act on.
async fn send(
    req: reqwest::RequestBuilder,
    cfg: &ProviderConfig,
    cancel: &CancellationToken,
) -> Result<reqwest::Response, AiError> {
    let resp = tokio::select! {
        r = req.send() => r,
        _ = cancel.cancelled() => return Err(AiError::Cancelled),
    };
    let resp = resp.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout
        } else {
            let hint = if cfg.base_url.contains("localhost:11434") { " and that Ollama is running" } else { "" };
            AiError::Unreachable(cfg.base_url.clone(), hint)
        }
    })?;
    let status = resp.status();
    if status.is_success() {
        return Ok(resp);
    }
    let text = resp.text().await.unwrap_or_default();
    let message = error_message(&text);
    Err(match status.as_u16() {
        401 | 403 => AiError::Unauthorized(message),
        404 => AiError::NotFound(message),
        429 => AiError::RateLimited,
        code => AiError::Http { status: code, message },
    })
}

/// Pulls the human-readable part out of an error body (`{"error":{"message":…}}`,
/// `{"error":"…"}`, or plain text).
fn error_message(body: &str) -> String {
    let parsed: Option<serde_json::Value> = serde_json::from_str(body).ok();
    let from_json = parsed.as_ref().and_then(|v| {
        let e = v.get("error")?;
        e.get("message").and_then(|m| m.as_str()).or_else(|| e.as_str()).map(str::to_string)
    });
    let text = from_json.unwrap_or_else(|| body.trim().to_string());
    let mut text: String = text.chars().take(300).collect();
    if text.is_empty() {
        text = "no details".into();
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn readable_errors() {
        assert_eq!(
            error_message(r#"{"error":{"type":"authentication_error","message":"invalid x-api-key"}}"#),
            "invalid x-api-key"
        );
        assert_eq!(error_message(r#"{"error":"model 'llama9' not found"}"#), "model 'llama9' not found");
        assert_eq!(error_message(""), "no details");
        assert!(AiError::Refused(Some("cyber".into())).to_string().contains("cyber"));
    }
}

#[cfg(test)]
mod provider_tests;
