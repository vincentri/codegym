//! The Anthropic Messages API (Claude), over raw HTTP since there is no official Rust SDK.

use serde_json::{Value, json};

use crate::sse::SseEvent;
use crate::{AiError, ChatEvent, ChatRequest, ProviderConfig, Role, StreamState};

const VERSION: &str = "2023-06-01";
/// Beta header for `fallbacks: "default"`: a declined request is retried server-side on the
/// model Anthropic recommends for that refusal category.
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
/// Models that accept `fallbacks: "default"`.
const FALLBACK_MODELS: [&str; 4] = ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"];
/// Model families that accept `output_config.effort`.
const EFFORT_PREFIXES: [&str; 10] = [
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-haiku-5",
    "claude-fable-5",
    "claude-mythos-5",
    "claude-opus-4-5",
    "claude-opus-4-6",
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
];

fn url(cfg: &ProviderConfig, path: &str) -> String {
    let base = cfg.base_url.trim_end_matches("/v1");
    format!("{base}/v1/{path}")
}

fn headers(req: reqwest::RequestBuilder, cfg: &ProviderConfig) -> reqwest::RequestBuilder {
    let req = req.header("anthropic-version", VERSION);
    match &cfg.api_key {
        Some(key) => req.header("x-api-key", key),
        None => req,
    }
}

/// Fallbacks are a first-party API feature; proxies and gateways may reject the parameter.
fn uses_fallback(cfg: &ProviderConfig) -> bool {
    FALLBACK_MODELS.contains(&cfg.model.as_str()) && cfg.base_url.contains("api.anthropic.com")
}

pub fn models_request(http: &reqwest::Client, cfg: &ProviderConfig) -> reqwest::RequestBuilder {
    headers(http.get(url(cfg, "models?limit=100")), cfg)
}

pub fn request_body(cfg: &ProviderConfig, req: &ChatRequest<'_>) -> Value {
    let messages: Vec<Value> = req
        .turns
        .iter()
        .map(|t| json!({ "role": if t.role == Role::User { "user" } else { "assistant" }, "content": t.content }))
        .collect();
    // Thinking is left at the model's default (adaptive on current models); effort controls depth.
    let mut body = json!({
        "model": cfg.model,
        "max_tokens": req.max_tokens,
        "system": req.system,
        "messages": messages,
        "stream": true,
    });
    if EFFORT_PREFIXES.iter().any(|p| cfg.model.starts_with(p))
        && ["low", "medium", "high"].contains(&cfg.effort.as_str())
    {
        body["output_config"] = json!({ "effort": cfg.effort });
    }
    if uses_fallback(cfg) {
        body["fallbacks"] = json!("default");
    }
    body
}

pub fn chat_request(http: &reqwest::Client, cfg: &ProviderConfig, req: &ChatRequest<'_>) -> reqwest::RequestBuilder {
    let mut builder = headers(http.post(url(cfg, "messages")), cfg);
    if uses_fallback(cfg) {
        builder = builder.header("anthropic-beta", FALLBACK_BETA);
    }
    builder.json(&request_body(cfg, req))
}

pub fn handle_event(
    event: &SseEvent,
    state: &mut StreamState,
    on_event: &mut (dyn FnMut(ChatEvent) + Send),
) -> Result<bool, AiError> {
    if event.data.trim().is_empty() {
        return Ok(false);
    }
    let v: Value = serde_json::from_str(&event.data).map_err(|e| AiError::Protocol(format!("bad stream data: {e}")))?;
    match v.get("type").and_then(Value::as_str).unwrap_or_default() {
        "content_block_start" => {
            // A fallback block marks the point where a declining model handed over: the text
            // before it was withdrawn, and the fallback model's text follows.
            if v.pointer("/content_block/type").and_then(Value::as_str) == Some("fallback") && !state.text.is_empty() {
                state.text.clear();
                on_event(ChatEvent::Reset);
            }
        }
        "content_block_delta" => {
            if v.pointer("/delta/type").and_then(Value::as_str) == Some("text_delta")
                && let Some(text) = v.pointer("/delta/text").and_then(Value::as_str)
            {
                state.push(text, on_event);
            }
        }
        "message_delta" => match v.pointer("/delta/stop_reason").and_then(Value::as_str) {
            Some("refusal") => {
                let category = v
                    .pointer("/delta/stop_details/category")
                    .or_else(|| v.pointer("/stop_details/category"))
                    .and_then(Value::as_str)
                    .map(str::to_string);
                state.refused = Some(category);
            }
            Some("max_tokens") => state.truncated = true,
            _ => {}
        },
        "message_stop" => return Ok(true),
        "error" => {
            let message = v.pointer("/error/message").and_then(Value::as_str).unwrap_or("unknown error");
            let kind = v.pointer("/error/type").and_then(Value::as_str).unwrap_or_default();
            return Err(if kind == "rate_limit_error" {
                AiError::RateLimited
            } else {
                AiError::Http { status: 200, message: message.to_string() }
            });
        }
        _ => {}
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ProviderConfig, Turn};

    fn cfg(model: &str) -> ProviderConfig {
        ProviderConfig::new("anthropic", "https://api.anthropic.com/", model, "high", Some("sk-ant-x".into()))
    }

    #[test]
    fn body_sets_effort_and_fallbacks_only_where_supported() {
        let turns = [Turn::user("hi")];
        let req = ChatRequest { system: "sys", turns: &turns, max_tokens: 100 };
        let opus = request_body(&cfg("claude-opus-5-5"), &req);
        assert_eq!(opus["fallbacks"], "default");
        assert_eq!(opus["output_config"]["effort"], "high");
        assert!(opus.get("thinking").is_none());
        let haiku = request_body(&cfg("claude-haiku-5-5"), &req);
        assert!(haiku.get("fallbacks").is_none());
        assert_eq!(haiku["output_config"]["effort"], "high");
        let old = request_body(&cfg("claude-haiku-4-5"), &req);
        assert!(old.get("output_config").is_none());
        assert_eq!(url(&cfg("x"), "messages"), "https://api.anthropic.com/v1/messages");
    }
}
