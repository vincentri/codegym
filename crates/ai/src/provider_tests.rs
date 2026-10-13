//! Both wire formats against a local mock server.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::json;

use crate::mock_server::{MockServer, Reply};
use crate::*;

fn openai(server: &MockServer, key: Option<&str>) -> ProviderConfig {
    ProviderConfig::new("ollama", &format!("{}/v1/", server.url), "qwen2.5-coder:7b", "medium", key.map(str::to_string))
}

fn claude(server: &MockServer, model: &str) -> ProviderConfig {
    ProviderConfig::new("anthropic", &server.url, model, "high", Some("sk-ant-test".into()))
}

/// Runs a chat and collects every event.
async fn chat(cfg: &ProviderConfig) -> (Result<ChatOutcome, AiError>, Vec<ChatEvent>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    let turns = [Turn::user("Give me a hint")];
    let req = ChatRequest { system: "You are a mentor.", turns: &turns, max_tokens: 1000 };
    let result =
        AiClient::new().chat(cfg, &req, &mut move |e| sink.lock().unwrap().push(e), &CancellationToken::new()).await;
    let events = events.lock().unwrap().clone();
    (result, events)
}

#[tokio::test]
async fn openai_compatible_streams_and_lists_models() {
    let server = MockServer::start().await;
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&["Think about ", "a hash ", "map."])]);
    server.route("GET", "/v1/models", vec![Reply::json(json!({ "data": [{ "id": "b-model" }, { "id": "a-model" }] }))]);

    let (result, events) = chat(&openai(&server, None)).await;
    assert_eq!(result.unwrap().text, "Think about a hash map.");
    assert_eq!(events.len(), 3, "one event per delta");

    let models = AiClient::new().list_models(&openai(&server, Some("k"))).await.unwrap();
    assert_eq!(models, ["a-model", "b-model"]);

    let reqs = server.requests();
    let body = reqs[0].json();
    assert_eq!(body["stream"], true);
    assert_eq!(body["messages"][0]["role"], "system");
    assert_eq!(body["messages"][1]["content"], "Give me a hint");
    assert!(reqs[0].header("authorization").is_none(), "no key, no auth header");
    assert_eq!(reqs[1].header("authorization"), Some("Bearer k"));
}

#[tokio::test]
async fn claude_streams_text_and_skips_thinking() {
    let server = MockServer::start().await;
    server.route("POST", "/v1/messages", vec![Reply::anthropic_stream(&["Try ", "two pointers."], "end_turn")]);
    let (result, _) = chat(&claude(&server, "claude-opus-5-5")).await;
    assert_eq!(result.unwrap(), ChatOutcome { text: "Try two pointers.".into(), truncated: false });

    let req = &server.requests()[0];
    assert_eq!(req.header("x-api-key"), Some("sk-ant-test"));
    assert_eq!(req.header("anthropic-version"), Some("2023-06-01"));
    assert_eq!(req.json()["system"], "You are a mentor.");
    assert_eq!(req.json()["output_config"]["effort"], "high");
    // The mock isn't api.anthropic.com, so no fallbacks are requested (see anthropic.rs tests).
    assert!(req.json().get("fallbacks").is_none());
}

#[tokio::test]
async fn claude_refusals_and_truncation() {
    let server = MockServer::start().await;
    server.route("POST", "/v1/messages", vec![Reply::anthropic_stream(&["Sure, here"], "refusal")]);
    let (result, _) = chat(&claude(&server, "claude-opus-5-5")).await;
    assert_eq!(result.unwrap_err(), AiError::Refused(Some("cyber".into())));

    server.route("POST", "/v1/messages", vec![Reply::anthropic_stream(&["long answer"], "max_tokens")]);
    let (result, _) = chat(&claude(&server, "claude-opus-5-5")).await;
    assert!(result.unwrap().truncated);
}

#[tokio::test]
async fn errors_are_readable() {
    let server = MockServer::start().await;
    server.route(
        "POST",
        "/v1/messages",
        vec![Reply::status(
            401,
            json!({ "type": "error", "error": { "type": "authentication_error", "message": "invalid x-api-key" } }),
        )],
    );
    let (result, _) = chat(&claude(&server, "claude-opus-5-5")).await;
    let err = result.unwrap_err();
    assert_eq!(err, AiError::Unauthorized("invalid x-api-key".into()));
    assert!(err.to_string().contains("Settings → AI Mentor"));

    server.route(
        "POST",
        "/v1/chat/completions",
        vec![Reply::status(404, json!({ "error": "model \"llama9\" not found" }))],
    );
    let (result, _) = chat(&openai(&server, None)).await;
    assert!(result.unwrap_err().to_string().contains("llama9"));

    // Nothing listens on port 9 (discard), so the connection is refused.
    let down = ProviderConfig::new("ollama", "http://127.0.0.1:9/v1", "m", "low", None);
    let (result, _) = chat(&down).await;
    assert!(matches!(result.unwrap_err(), AiError::Unreachable(..)));
}

#[tokio::test]
async fn cancelling_stops_the_stream() {
    let server = MockServer::start().await;
    let pieces: Vec<String> = (0..50).map(|i| format!("w{i} ")).collect();
    let refs: Vec<&str> = pieces.iter().map(String::as_str).collect();
    server.route(
        "POST",
        "/v1/chat/completions",
        vec![Reply::openai_stream(&refs).with_delay(Duration::from_millis(40))],
    );
    let cfg = openai(&server, None);
    let cancel = CancellationToken::new();
    let stopper = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(300)).await;
        stopper.cancel();
    });
    let received = Arc::new(Mutex::new(0usize));
    let counter = received.clone();
    let turns = [Turn::user("hi")];
    let req = ChatRequest { system: "s", turns: &turns, max_tokens: 10 };
    let started = std::time::Instant::now();
    let result = AiClient::new().chat(&cfg, &req, &mut move |_| *counter.lock().unwrap() += 1, &cancel).await;
    assert_eq!(result.unwrap_err(), AiError::Cancelled);
    assert!(started.elapsed() < Duration::from_secs(1));
    let n = *received.lock().unwrap();
    assert!(n > 0 && n < 50, "got {n} deltas before stopping");
}

#[tokio::test]
async fn fallback_handover_resets_the_text() {
    let server = MockServer::start().await;
    let ev = |name: &str, data: serde_json::Value| format!("event: {name}\ndata: {data}\n\n");
    server.route(
        "POST",
        "/v1/messages",
        vec![Reply::sse(vec![
            ev("content_block_delta", json!({ "type": "content_block_delta", "index": 0, "delta": { "type": "text_delta", "text": "partial" } })),
            ev("content_block_start", json!({ "type": "content_block_start", "index": 1, "content_block": { "type": "fallback", "from": { "model": "claude-opus-5-5" }, "to": { "model": "claude-opus-5" } } })),
            ev("content_block_delta", json!({ "type": "content_block_delta", "index": 2, "delta": { "type": "text_delta", "text": "fresh answer" } })),
            ev("message_delta", json!({ "type": "message_delta", "delta": { "stop_reason": "end_turn" } })),
            ev("message_stop", json!({ "type": "message_stop" })),
        ])],
    );
    let (result, events) = chat(&claude(&server, "claude-opus-5-5")).await;
    assert_eq!(result.unwrap().text, "fresh answer");
    assert_eq!(events[1], ChatEvent::Reset);
}
