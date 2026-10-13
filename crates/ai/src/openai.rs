//! OpenAI-compatible chat completions (Ollama, OpenCode Zen, LM Studio, OpenRouter, Groq, …).

use serde_json::{Value, json};

use crate::sse::SseEvent;
use crate::{AiError, ChatEvent, ChatRequest, ProviderConfig, Role, StreamState};

fn authed(req: reqwest::RequestBuilder, cfg: &ProviderConfig) -> reqwest::RequestBuilder {
    match &cfg.api_key {
        Some(key) => req.bearer_auth(key),
        None => req,
    }
}

pub fn models_request(http: &reqwest::Client, cfg: &ProviderConfig) -> reqwest::RequestBuilder {
    authed(http.get(format!("{}/models", cfg.base_url)), cfg)
}

pub fn chat_request(http: &reqwest::Client, cfg: &ProviderConfig, req: &ChatRequest<'_>) -> reqwest::RequestBuilder {
    let mut messages = vec![json!({ "role": "system", "content": req.system })];
    messages.extend(
        req.turns
            .iter()
            .map(|t| json!({ "role": if t.role == Role::User { "user" } else { "assistant" }, "content": t.content })),
    );
    let mut body = json!({ "model": cfg.model, "messages": messages, "stream": true });
    // Many compatible servers cap max_tokens lower than Claude does; above that, leave it to
    // the server's default rather than risk a rejected request.
    if req.max_tokens <= 8192 {
        body["max_tokens"] = json!(req.max_tokens);
    }
    authed(http.post(format!("{}/chat/completions", cfg.base_url)), cfg).json(&body)
}

pub fn handle_event(
    event: &SseEvent,
    state: &mut StreamState,
    on_event: &mut (dyn FnMut(ChatEvent) + Send),
) -> Result<bool, AiError> {
    let data = event.data.trim();
    if data == "[DONE]" {
        return Ok(true);
    }
    if data.is_empty() {
        return Ok(false);
    }
    let v: Value = serde_json::from_str(data).map_err(|e| AiError::Protocol(format!("bad stream data: {e}")))?;
    if let Some(err) = v.get("error") {
        let message = err.get("message").and_then(Value::as_str).or_else(|| err.as_str()).unwrap_or("unknown error");
        return Err(AiError::Http { status: 200, message: message.to_string() });
    }
    let Some(choice) = v.get("choices").and_then(|c| c.get(0)) else { return Ok(false) };
    if let Some(text) = choice.pointer("/delta/content").and_then(Value::as_str) {
        state.push(text, on_event);
    }
    if choice.get("finish_reason").and_then(Value::as_str) == Some("length") {
        state.truncated = true;
    }
    Ok(false)
}
