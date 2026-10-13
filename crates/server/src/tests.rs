use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codegym_ai::MemoryStore;
use codegym_ai::mock_server::{MockServer, Reply};
use codegym_runner::RunnerConfig;
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

use super::*;

const TWO_SUM_JS: &str = "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n";

struct Harness {
    router: Router,
    _dir: tempfile::TempDir,
}

fn harness() -> Harness {
    let dir = tempfile::tempdir().unwrap();
    let config = RunnerConfig { python_dir: None, cache_dir: None, force_quickjs: true };
    let service = Service::open(&dir.path().join("codegym.db"), config, Arc::new(MemoryStore::default())).unwrap();
    let ui = dir.path().join("ui");
    std::fs::create_dir_all(&ui).unwrap();
    std::fs::write(ui.join("index.html"), "<!doctype html><title>CodeGym</title>").unwrap();
    let state = AppState::new(Arc::new(service), vec!["codegym.lan".into()]);
    Harness { router: app(state, Some(ui)), _dir: dir }
}

impl Harness {
    async fn send(&self, req: Request<Body>) -> (StatusCode, String) {
        let res = self.router.clone().oneshot(req).await.unwrap();
        let status = res.status();
        let body = res.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8(body.to_vec()).unwrap())
    }

    async fn call(&self, command: &str, args: Value) -> (StatusCode, Value) {
        let req = Request::post(format!("/api/{command}"))
            .header("host", "localhost:8080")
            .header("content-type", "application/json")
            .body(Body::from(args.to_string()))
            .unwrap();
        let (status, body) = self.send(req).await;
        (status, serde_json::from_str(&body).unwrap_or(Value::String(body)))
    }

    async fn ok(&self, command: &str, args: Value) -> Value {
        let (status, body) = self.call(command, args).await;
        assert_eq!(status, StatusCode::OK, "{command}: {body}");
        body
    }

    /// The lines of a streaming reply.
    async fn stream(&self, command: &str, args: Value) -> Vec<Value> {
        let req = Request::post(format!("/api/{command}"))
            .header("host", "localhost")
            .header("content-type", "application/json")
            .body(Body::from(args.to_string()))
            .unwrap();
        let (status, body) = self.send(req).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        body.lines().map(|l| serde_json::from_str(l).unwrap()).collect()
    }
}

#[tokio::test]
async fn commands_answer_like_the_desktop_app() {
    let h = harness();
    let problems = h.ok("list_problems", json!(null)).await;
    assert!(problems.as_array().unwrap().len() >= 30);
    assert_eq!(h.ok("get_problem", json!({ "id": "two-sum" })).await["signature"]["functionName"], "twoSum");

    let req = json!({ "problemId": "two-sum", "language": "javascript", "code": TWO_SUM_JS, "customInputs": [] });
    assert_eq!(h.ok("run_code", json!({ "req": req })).await["verdict"], "accepted");
    let draft = h.ok("save_draft", json!({ "problemId": "two-sum", "language": "javascript", "code": "x" })).await;
    assert_eq!(draft["code"], "x");
    assert_eq!(h.ok("get_draft", json!({ "problemId": "two-sum", "language": "javascript" })).await["code"], "x");
    assert_eq!(
        h.ok("record_activity", json!({ "event": { "type": "problem_opened", "problemId": "two-sum" } })).await,
        Value::Null
    );
}

#[tokio::test]
async fn errors_carry_kind_and_message() {
    let h = harness();
    let (status, body) = h.call("get_problem", json!({ "id": "nope" })).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["kind"], "not_found");

    let (status, body) = h.call("get_problem", json!({ "wrong": 1 })).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body["message"].as_str().unwrap().contains("get_problem"), "{body}");

    let (status, body) = h.call("no_such_command", json!({})).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");

    let (status, body) = h.call("open_data_folder", json!(null)).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["kind"], "unavailable");
}

#[tokio::test]
async fn other_sites_cant_drive_the_api() {
    let h = harness();
    // A form or a no-cors fetch from another site can't set a JSON content type.
    let req = Request::post("/api/list_problems")
        .header("host", "localhost:8080")
        .header("content-type", "text/plain")
        .body(Body::from("{}"))
        .unwrap();
    assert_eq!(h.send(req).await.0, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    // DNS rebinding: a request naming another site's host.
    let req = Request::post("/api/list_problems")
        .header("host", "evil.example:8080")
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    assert_eq!(h.send(req).await.0, StatusCode::FORBIDDEN);
    // Names listed in CODEGYM_ALLOWED_HOSTS are fine.
    let req = Request::get("/api/health").header("host", "codegym.lan:8080").body(Body::empty()).unwrap();
    assert_eq!(h.send(req).await, (StatusCode::OK, "ok".into()));
}

#[tokio::test]
async fn serves_the_ui() {
    let h = harness();
    let req = Request::get("/").header("host", "127.0.0.1:8080").body(Body::empty()).unwrap();
    let (status, body) = h.send(req).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains("<title>CodeGym</title>"));
}

#[tokio::test]
async fn problem_packs_travel_as_text() {
    let h = harness();
    let (status, body) = h.call("export_problem_pack_text", json!(null)).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "nothing to export yet: {body}");

    let (status, body) = h.call("import_problem_pack_text", json!({ "text": "not a pack" })).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(body["message"].as_str().unwrap().contains("problem pack"), "{body}");
}

#[tokio::test(flavor = "multi_thread")]
async fn mentor_replies_stream_as_ndjson() {
    let h = harness();
    let server = MockServer::start().await;
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&["Think about ", "complements."])]);
    let form = json!({
        "id": null, "provider": "custom", "name": "Local", "baseUrl": format!("{}/v1", server.url),
        "model": "m", "apiKey": "", "hasStoredKey": false, "effort": "medium", "mentorStyle": "socratic",
    });
    h.ok("save_ai_profile", json!({ "form": form })).await;

    let req = json!({
        "problemId": "two-sum", "language": "javascript", "mode": "hint",
        "message": "Help", "code": TWO_SUM_JS, "lastRun": null,
    });
    let lines = h.stream("send_mentor_message", json!({ "req": req, "requestId": "r1" })).await;
    let text: String = lines.iter().filter_map(|l| l["event"]["text"].as_str()).collect();
    assert_eq!(text, "Think about complements.");
    assert_eq!(lines.last().unwrap(), &json!({ "result": null }));

    // Generation without a valid request ends with an error line, not a broken stream.
    let gen_req = json!({ "topic": "", "difficulty": "easy", "count": 1, "notes": "", "planId": null });
    let lines = h.stream("generate_questions", json!({ "req": gen_req })).await;
    assert_eq!(lines.last().unwrap()["error"]["kind"], "invalid");

    assert_eq!(h.ok("cancel_ai", json!({ "requestId": "unknown" })).await, Value::Null);
}

/// The desktop app and this server must offer the same commands, so the UI works on both.
#[test]
fn every_desktop_command_is_served() {
    let tauri = include_str!("../../../apps/desktop/src-tauri/src/lib.rs");
    let list = tauri.split("generate_handler![").nth(1).unwrap().split(']').next().unwrap();
    // Packs use file paths in the app and file contents here; the data folder can't be opened.
    let replaced = ["export_problem_pack", "import_problem_pack"];
    for name in list.split(',').map(str::trim).filter(|n| !n.is_empty()) {
        if !replaced.contains(&name) {
            assert!(COMMANDS.contains(&name), "the server is missing the desktop command {name}");
        }
    }
}
