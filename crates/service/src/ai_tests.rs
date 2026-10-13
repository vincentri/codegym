//! AI features against a mock provider. Multi-threaded runtimes, because verification runs the
//! reference solution with `block_in_place`.

use std::sync::{Arc, Mutex};

use codegym_ai::mock_server::{MockServer, Reply};
use codegym_ai::{Cancel, MemoryStore, SecretStore};
use codegym_core::{
    AiProfileForm, Difficulty, GenerateProgress, GenerateRequest, Language, MentorRequest, MentorStreamEvent,
    RunResult, Store, TestResult, Verdict,
};
use serde_json::json;

use crate::tests::service;
use crate::{Service, ServiceError};

fn form(server: &MockServer, key: &str) -> AiProfileForm {
    AiProfileForm {
        id: None,
        provider: "custom".into(),
        name: "Mock".into(),
        base_url: format!("{}/v1", server.url),
        model: "mock-model".into(),
        api_key: key.into(),
        has_stored_key: false,
        effort: "medium".into(),
        mentor_style: "socratic".into(),
    }
}

/// A service whose active AI profile points at a fresh mock server.
async fn connected() -> (Service, MockServer) {
    let server = MockServer::start().await;
    let s = service();
    s.save_ai_profile(&form(&server, "")).unwrap();
    (s, server)
}

#[tokio::test(flavor = "multi_thread")]
async fn keys_go_to_the_keychain_not_the_database() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("codegym.db");
    let secrets = Arc::new(MemoryStore::default());
    let s = Service::new(Store::open(&db).unwrap(), Default::default(), secrets.clone());
    let server = MockServer::start().await;

    let saved = s.save_ai_profile(&form(&server, "sk-very-secret")).unwrap();
    assert!(saved.has_api_key && saved.is_active);
    assert_eq!(secrets.get(&saved.id).unwrap().as_deref(), Some("sk-very-secret"));

    // Editing with a blank key keeps the stored one.
    let edit = AiProfileForm { id: Some(saved.id.clone()), name: "Renamed".into(), ..form(&server, "") };
    assert!(s.save_ai_profile(&edit).unwrap().has_api_key);
    // …and it is what requests use.
    server.route("GET", "/v1/models", vec![Reply::json(json!({ "data": [{ "id": "mock-model" }] }))]);
    s.list_models(&edit).await.unwrap();
    assert_eq!(server.requests()[0].header("authorization"), Some("Bearer sk-very-secret"));

    drop(s);
    let bytes =
        [std::fs::read(&db).unwrap(), std::fs::read(dir.path().join("codegym.db-wal")).unwrap_or_default()].concat();
    assert!(!bytes.windows(14).any(|w| w == b"sk-very-secret"), "the key must never reach SQLite");

    let s = Service::new(Store::open(&db).unwrap(), Default::default(), secrets.clone());
    s.delete_ai_profile(&saved.id).unwrap();
    assert!(secrets.get(&saved.id).unwrap().is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn connection_test_reports_latency_or_a_useful_error() {
    let (s, server) = connected().await;
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&["OK"])]);
    let ok = s.test_connection(&form(&server, "")).await.unwrap();
    assert!(ok.ok && ok.latency_ms.is_some());

    server.route("POST", "/v1/chat/completions", vec![Reply::status(404, json!({ "error": "model not found" }))]);
    server.route("GET", "/v1/models", vec![Reply::json(json!({ "data": [{ "id": "llama3" }, { "id": "qwen" }] }))]);
    let bad = s.test_connection(&form(&server, "")).await.unwrap();
    assert!(!bad.ok);
    assert!(bad.error.unwrap().contains("Try one of: llama3, qwen"));
}

fn failing_run() -> RunResult {
    let visible = TestResult {
        index: 0,
        hidden: false,
        custom: false,
        input: Some(vec![json!([3, 2, 4]), json!(6)]),
        expected: Some(json!([1, 2])),
        actual: Some(json!([0, 0])),
        passed: Some(false),
        stdout: String::new(),
        error: None,
        time_ms: 1.0,
    };
    let hidden = TestResult {
        index: 4,
        hidden: true,
        input: None,
        expected: None,
        actual: None,
        stdout: "SECRET".into(),
        ..visible.clone()
    };
    RunResult {
        verdict: Verdict::WrongAnswer,
        passed: 0,
        total: 2,
        results: vec![visible, hidden],
        compile_output: None,
        total_time_ms: 2.0,
    }
}

fn mentor(mode: &str) -> MentorRequest {
    MentorRequest {
        problem_id: "two-sum".into(),
        language: Language::Python,
        mode: mode.into(),
        message: "Give me a hint.".into(),
        code: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 0]\n".into(),
        last_run: Some(failing_run()),
    }
}

async fn ask(s: &Service, req: &MentorRequest) -> Vec<MentorStreamEvent> {
    let events = Arc::new(Mutex::new(Vec::new()));
    let sink = events.clone();
    s.send_mentor_message(req, &mut move |e| sink.lock().unwrap().push(e), &Cancel::new()).await.unwrap();
    events.lock().unwrap().clone()
}

#[tokio::test(flavor = "multi_thread")]
async fn mentor_streams_saves_and_sees_the_code_but_not_hidden_tests() {
    let (s, server) = connected().await;
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&["What do you ", "need to remember?"])]);
    let events = ask(&s, &mentor("hint")).await;
    assert_eq!(events.len(), 3);
    let MentorStreamEvent::Done { message } = &events[2] else { panic!("{events:?}") };
    assert_eq!(message.content, "What do you need to remember?");

    let chat = s.list_chat("two-sum").unwrap();
    assert_eq!(chat.iter().map(|m| m.role.as_str()).collect::<Vec<_>>(), ["user", "assistant"]);
    assert_eq!(chat[0].content, "Give me a hint.");

    let body = server.requests()[0].json();
    let system = body["messages"][0]["content"].as_str().unwrap();
    assert!(system.contains("Do not write a full solution"));
    let turn = body["messages"][1]["content"].as_str().unwrap();
    assert!(
        turn.contains("return [0, 0]") && turn.contains("input: [[3,2,4],6]") && turn.contains("Give exactly one hint")
    );
    assert!(turn.contains("Hidden test 5 failed") && !turn.contains("SECRET"));

    // The next question carries the history.
    ask(&s, &mentor("chat")).await;
    let body = server.requests()[1].json();
    let roles: Vec<&str> = body["messages"].as_array().unwrap().iter().map(|m| m["role"].as_str().unwrap()).collect();
    assert_eq!(roles, ["system", "user", "assistant", "user"]);
}

#[tokio::test(flavor = "multi_thread")]
async fn mentor_errors_are_shown_and_a_missing_profile_is_explained() {
    let (s, server) = connected().await;
    server.route(
        "POST",
        "/v1/chat/completions",
        vec![Reply::status(401, json!({ "error": { "message": "bad key" } }))],
    );
    let events = ask(&s, &mentor("hint")).await;
    let [MentorStreamEvent::Error { message }] = events.as_slice() else { panic!("{events:?}") };
    assert!(message.contains("bad key"));

    let none = service();
    let err = none.send_mentor_message(&mentor("hint"), &mut |_| {}, &Cancel::new()).await.unwrap_err();
    assert!(matches!(err, ServiceError::Unavailable(m) if m.contains("Settings → AI Mentor")));
}

#[tokio::test(flavor = "multi_thread")]
async fn cancelled_replies_keep_what_arrived() {
    let (s, server) = connected().await;
    let words: Vec<String> = (0..40).map(|i| format!("w{i} ")).collect();
    let refs: Vec<&str> = words.iter().map(String::as_str).collect();
    server.route(
        "POST",
        "/v1/chat/completions",
        vec![Reply::openai_stream(&refs).with_delay(std::time::Duration::from_millis(30))],
    );
    let cancel = Cancel::new();
    let stopper = cancel.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        stopper.cancel();
    });
    s.send_mentor_message(&mentor("chat"), &mut |_| {}, &cancel).await.unwrap();
    let saved = s.list_chat("two-sum").unwrap();
    let reply = &saved.last().unwrap().content;
    assert!(reply.starts_with("w0 ") && reply.ends_with("_(stopped)_") && !reply.contains("w39"), "{reply}");
}

/// A draft whose reference returns the sum, but with a wrong expected answer, a test that makes
/// the reference throw, and a test with a bad input type.
pub(crate) fn sum_draft(reference: &str) -> serde_json::Value {
    json!({
        "title": "Sum of a List",
        "difficulty": "easy",
        "categoryIds": ["array", "made-up"],
        "descriptionMd": "Return the sum of `nums`.",
        "constraints": ["0 ≤ n ≤ 5"],
        "hints": ["Keep a running total."],
        "signature": { "functionName": "sumAll", "params": [{ "name": "nums", "type": "int[]" }], "returns": "int" },
        "comparator": "exact",
        "inPlaceArg": null,
        "tests": [
            { "input": [[1, 2, 3]], "expected": 999 },
            { "input": [[]], "expected": 0, "hidden": true },
            { "input": [[4, 4]], "expected": 8, "hidden": true },
            { "input": [[1, 2, 3, 4, 5, 6]], "expected": 21, "hidden": true },
            { "input": [["x"]], "expected": 0, "hidden": true }
        ],
        "referenceJs": reference
    })
}

pub(crate) const SUM_JS: &str = "function sumAll(nums) {\n  if (nums.length > 5) throw new Error('too long');\n  return nums.reduce((a, b) => a + b, 0);\n}";

#[tokio::test(flavor = "multi_thread")]
async fn import_verifies_tests_by_running_the_reference() {
    let (s, server) = connected().await;
    let reply = format!("Here you go:\n```json\n{}\n```", sum_draft(SUM_JS));
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&[&reply])]);
    let g = s.import_problem("Given a list of numbers, return their sum. Example: [1,2,3] → 6").await.unwrap();
    assert_eq!((g.verified_tests, g.dropped_tests), (3, 2));
    assert_eq!(g.question.tests[0].expected, json!(6), "the wrong expected answer is replaced by the real one");
    assert!(!g.question.tests[0].hidden);
    assert_eq!(g.question.category_ids, ["array"], "unknown categories are dropped");
    assert_eq!(g.question.origin, codegym_core::ProblemOrigin::AiImported);
    assert_eq!(g.question.reference.as_ref().unwrap().language, Language::Javascript);
    // The pasted text went to the AI with the format spec.
    let prompt = server.requests()[0].json()["messages"][1]["content"].as_str().unwrap().to_string();
    assert!(prompt.contains("Given a list of numbers") && prompt.contains("referenceJs"));
}

#[tokio::test(flavor = "multi_thread")]
async fn import_repairs_once_then_gives_up() {
    let (s, server) = connected().await;
    let good = sum_draft(SUM_JS).to_string();
    server.route(
        "POST",
        "/v1/chat/completions",
        vec![Reply::openai_stream(&["Sorry, here is {not json"]), Reply::openai_stream(&[&good])],
    );
    let g = s.import_problem("A problem statement that is long enough to import.").await.unwrap();
    assert_eq!(g.verified_tests, 3);
    let second = server.requests()[1].json();
    let last = second["messages"].as_array().unwrap().last().unwrap()["content"].as_str().unwrap().to_string();
    assert!(last.contains("couldn't be used"), "{last}");

    let broken = sum_draft("function sumAll(nums) { return ; ").to_string();
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&[&broken])]);
    let err = s.import_problem("A problem statement that is long enough to import.").await.unwrap_err();
    assert!(err.to_string().contains("referenceJs didn't run"), "{err}");
}

#[tokio::test(flavor = "multi_thread")]
async fn generate_keeps_verified_questions_and_reports_progress() {
    let (s, server) = connected().await;
    let mut second = sum_draft(SUM_JS);
    second["title"] = json!("Broken One");
    second["referenceJs"] = json!("function sumAll( {");
    let reply = json!([sum_draft(SUM_JS), second]).to_string();
    server.route("POST", "/v1/chat/completions", vec![Reply::openai_stream(&[&reply])]);

    let steps = Arc::new(Mutex::new(Vec::new()));
    let sink = steps.clone();
    let req = GenerateRequest {
        topic: "Array".into(),
        difficulty: Difficulty::Medium,
        count: 2,
        notes: "uses a running total".into(),
        plan_id: None,
    };
    let out = s.generate_questions(&req, &mut move |p| sink.lock().unwrap().push(p)).await.unwrap();
    assert_eq!(out.len(), 1);
    assert_eq!(out[0].question.difficulty, Difficulty::Medium);
    assert_eq!(out[0].question.origin, codegym_core::ProblemOrigin::AiGenerated);
    assert_eq!(
        *steps.lock().unwrap(),
        [GenerateProgress::Writing, GenerateProgress::Testing, GenerateProgress::Verifying, GenerateProgress::Done]
    );
    let prompt = server.requests()[0].json()["messages"][1]["content"].as_str().unwrap().to_string();
    assert!(prompt.contains("about \"Array\"") && prompt.contains("running total") && prompt.contains("Two Sum"));

    let bad = GenerateRequest { count: 9, ..req };
    assert!(s.generate_questions(&bad, &mut |_| {}).await.is_err());
}
