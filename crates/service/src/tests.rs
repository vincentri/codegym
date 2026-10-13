use std::path::PathBuf;

use codegym_core::{
    Comparator, Difficulty, Language, Param, ParamType, ProblemOrigin, ProblemStatus, QuestionInput, ReferenceSolution,
    RunRequest, Signature, Store, TestCase, Verdict, VerifyRequest, VerifyTest,
};
use codegym_runner::{RunnerConfig, Trust};
use serde_json::json;

use super::*;

pub(crate) fn service() -> Service {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let python = root.join("apps/desktop/src-tauri/resources/python");
    Service::new(
        Store::open_in_memory().unwrap(),
        RunnerConfig {
            python_dir: python.join("python.wasm").is_file().then_some(python),
            cache_dir: Some(root.join("target/wasmtime-cache")),
            force_quickjs: false,
        },
        std::sync::Arc::new(codegym_ai::MemoryStore::default()),
    )
}

const TWO_SUM_JS: &str = "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n";

fn request(code: &str) -> RunRequest {
    RunRequest {
        problem_id: "two-sum".into(),
        language: Language::Javascript,
        code: code.into(),
        custom_inputs: vec![],
    }
}

#[test]
fn run_uses_examples_and_custom_inputs_and_saves_the_draft() {
    let s = service();
    let mut req = request(TWO_SUM_JS);
    req.custom_inputs = vec![vec![json!([5, 5]), json!(10)]];
    let result = s.run_code(&req).unwrap();
    let examples = s.get_problem("two-sum").unwrap().examples.len();
    assert_eq!(result.verdict, Verdict::Accepted);
    assert_eq!((result.total, result.results.len()), (examples, examples + 1));
    assert_eq!(result.results.last().unwrap().actual, Some(json!([0, 1])));
    assert_eq!(s.get_draft("two-sum", Language::Javascript).unwrap().unwrap().code, TWO_SUM_JS);
    assert_eq!(s.list_problems().unwrap()[0].status, ProblemStatus::Todo, "a run alone doesn't count as an attempt");
}

#[test]
fn submit_runs_hidden_tests_and_records_the_solve() {
    let s = service();
    let wrong = s.submit_code(&request("function twoSum() { return [0, 1]; }")).unwrap();
    assert_eq!(wrong.run.verdict, Verdict::WrongAnswer);
    assert!(!wrong.first_solve);
    assert!(wrong.run.results.iter().any(|r| r.hidden), "submit includes hidden tests");

    let right = s.submit_code(&request(TWO_SUM_JS)).unwrap();
    assert_eq!(right.run.verdict, Verdict::Accepted);
    assert!(right.first_solve);
    assert_eq!(right.submission.passed as usize, right.run.total);
    assert_eq!(s.get_problem("two-sum").unwrap().summary.status, ProblemStatus::Solved);
    assert_eq!(s.get_stats().unwrap().solved, 1);
    assert_eq!(s.list_submissions("two-sum").unwrap().len(), 2);
}

#[test]
fn starter_code_comes_from_the_signature() {
    let s = service();
    assert!(
        s.starter_code("two-sum", Language::Go).unwrap().starts_with("func twoSum(nums []int, target int) []int {")
    );
    assert!(matches!(s.starter_code("nope", Language::Go), Err(ServiceError::NotFound(_))));
}

fn sum_question(reference: &str) -> QuestionInput {
    QuestionInput {
        title: "Sum All".into(),
        difficulty: Difficulty::Easy,
        category_ids: vec!["array".into()],
        description_md: "Add up the numbers.".into(),
        constraints: vec![],
        hints: vec![],
        signature: Signature {
            function_name: "sumAll".into(),
            params: vec![Param { name: "nums".into(), ty: ParamType::IntArray }],
            returns: ParamType::Int,
        },
        comparator: Comparator::Exact,
        in_place_arg: None,
        tests: vec![
            TestCase { input: vec![json!([1, 2, 3])], expected: json!(6), hidden: false },
            TestCase { input: vec![json!([])], expected: json!(0), hidden: true },
            TestCase { input: vec![json!([-4, 4])], expected: json!(0), hidden: true },
        ],
        reference: Some(ReferenceSolution { language: Language::Python, code: reference.into() }),
        origin: ProblemOrigin::Manual,
        forked_from: None,
    }
}

#[test]
fn saving_a_question_verifies_its_reference() {
    let s = service();
    let good = s
        .create_question(&sum_question("class Solution:\n    def sumAll(self, nums):\n        return sum(nums)\n"))
        .unwrap();
    let bad =
        s.create_question(&sum_question("class Solution:\n    def sumAll(self, nums):\n        return 1\n")).unwrap();
    let bank = s.list_bank_questions().unwrap();
    let verified = |id: &str| bank.iter().find(|q| q.summary.id == id).unwrap().verified;
    assert!(verified(&good.id));
    assert!(!verified(&bad.id));
}

#[test]
fn verify_reports_each_test_and_explains_failures_to_start() {
    let s = service();
    let q = sum_question("");
    let mut req = VerifyRequest {
        signature: q.signature.clone(),
        comparator: q.comparator,
        in_place_arg: None,
        tests: q.tests.iter().map(|t| VerifyTest { input: t.input.clone(), expected: t.expected.clone() }).collect(),
        language: Language::Javascript,
        code: "function sumAll(nums) { return nums.length ? nums.reduce((a, b) => a + b) : 1; }".into(),
    };
    let result = s.verify_reference(&req, Trust::Untrusted).unwrap();
    assert!(result.executed);
    assert_eq!(result.results.iter().map(|r| r.passed).collect::<Vec<_>>(), [true, false, true]);
    assert_eq!(result.results[1].actual, json!(1));

    req.code = "function sumAll(nums) { return ; ".into();
    let broken = s.verify_reference(&req, Trust::Untrusted).unwrap();
    assert!(!broken.executed);
    assert!(broken.note.unwrap().contains("SyntaxError"));
}

#[test]
fn errors_serialize_for_the_ui() {
    let e = ServiceError::Invalid("Plan names are 2–60 characters".into());
    assert_eq!(
        serde_json::to_value(&e).unwrap(),
        json!({ "kind": "invalid", "message": "Plan names are 2–60 characters" })
    );
}

/// Records real responses for `apps/desktop/src/api/backend-contract.test.ts`, which parses them
/// with the UI's Zod schemas. Values change between runs (ids, times), so this test only
/// compares the shape; `UPDATE_CONTRACT=1` rewrites the file.
#[tokio::test(flavor = "multi_thread")]
async fn contract_fixture_is_up_to_date() {
    use codegym_ai::mock_server::{MockServer, Reply};
    use serde_json::{Map, Value};
    let s = service();
    let server = MockServer::start().await;
    let mut req = request(TWO_SUM_JS);
    req.custom_inputs = vec![vec![json!([1, 2]), json!(3)]];
    let run = s.run_code(&req).unwrap();
    let failed = s.run_code(&request("function twoSum() { throw new Error('boom'); }")).unwrap();
    let compile_error = s.run_code(&request("function twoSum( {")).unwrap();
    s.save_draft("two-sum", Language::Python, "class Solution: pass").unwrap();
    s.record_activity(&codegym_core::ActivityEvent::ProblemOpened { problem_id: "two-sum".into() }).unwrap();
    let submit = s.submit_code(&request(TWO_SUM_JS)).unwrap();
    let question = s
        .create_question(&sum_question("class Solution:\n    def sumAll(self, nums):\n        return sum(nums)\n"))
        .unwrap();
    let category = s
        .save_category(&codegym_core::CategoryForm {
            id: None,
            name: "Warm-ups".into(),
            color: "green".into(),
            description: String::new(),
        })
        .unwrap();
    let plan = s
        .save_plan(&codegym_core::PlanForm { id: None, name: "Week 1".into(), description: "First week".into() })
        .unwrap();
    s.set_plan_items(&plan.id, &["two-sum".into(), question.id.clone()]).unwrap();
    let profile = s
        .save_ai_profile(&codegym_core::AiProfileForm {
            id: None,
            provider: "custom".into(),
            name: "Local".into(),
            base_url: format!("{}/v1", server.url),
            model: "qwen2.5-coder".into(),
            api_key: "sk-test".into(),
            has_stored_key: false,
            effort: "medium".into(),
            mentor_style: "socratic".into(),
        })
        .unwrap();
    let verify = s
        .verify_reference(
            &VerifyRequest {
                signature: question.input.signature.clone(),
                comparator: question.input.comparator,
                in_place_arg: None,
                tests: question
                    .input
                    .tests
                    .iter()
                    .map(|t| VerifyTest { input: t.input.clone(), expected: t.expected.clone() })
                    .collect(),
                language: Language::Javascript,
                code: "function sumAll(nums) { return nums.reduce((a, b) => a + b, 0); }".into(),
            },
            Trust::User,
        )
        .unwrap();

    // AI calls, answered by the mock provider in this order.
    let draft = crate::ai_tests::sum_draft(crate::ai_tests::SUM_JS);
    server.route(
        "POST",
        "/v1/chat/completions",
        vec![
            Reply::openai_stream(&["Think about ", "complements."]),
            Reply::openai_stream(&[&draft.to_string()]),
            Reply::openai_stream(&[&json!([draft]).to_string()]),
            Reply::openai_stream(&["OK"]),
        ],
    );
    server.route("GET", "/v1/models", vec![Reply::json(json!({ "data": [{ "id": "qwen2.5-coder" }] }))]);
    let mut mentor_events = Vec::new();
    let ask = codegym_core::MentorRequest {
        problem_id: "two-sum".into(),
        language: Language::Javascript,
        mode: "hint".into(),
        message: "Give me a hint.".into(),
        code: TWO_SUM_JS.into(),
        last_run: Some(failed.clone()),
    };
    s.send_mentor_message(&ask, &mut |e| mentor_events.push(e), &codegym_ai::Cancel::new()).await.unwrap();
    let imported = s.import_problem("Return the sum of a list of numbers, e.g. [1,2,3] → 6.").await.unwrap();
    let generate = codegym_core::GenerateRequest {
        topic: "Array".into(),
        difficulty: codegym_core::Difficulty::Easy,
        count: 1,
        notes: String::new(),
        plan_id: None,
    };
    let generated = s.generate_questions(&generate, &mut |_| {}).await.unwrap();
    let form = codegym_core::AiProfileForm {
        id: Some(profile.id.clone()),
        provider: "custom".into(),
        name: "Local".into(),
        base_url: format!("{}/v1", server.url),
        model: "qwen2.5-coder".into(),
        api_key: String::new(),
        has_stored_key: true,
        effort: "medium".into(),
        mentor_style: "socratic".into(),
    };
    let connection = s.test_connection(&form).await.unwrap();
    let models = s.list_models(&form).await.unwrap();

    let pack_dir = tempfile::tempdir().unwrap();
    let exported = s.export_problem_pack(&pack_dir.path().join("mine.codegym.json")).unwrap();
    let pack = s.problem_pack().unwrap();
    // Everything in it is already here, so this records the "skipped" shape too.
    let pack_import = s.import_pack_text(&serde_json::to_string(&pack).unwrap()).unwrap();
    // The UI mirrors starter code in TypeScript (`lib/starter-code.ts`); these are compared there.
    let starter: Vec<Value> =
        ["two-sum", "move-zeroes", "invert-binary-tree", "merge-k-sorted-lists", "number-of-islands"]
            .iter()
            .map(|id| {
                let p = s.get_problem(id).unwrap();
                let code: Map<String, Value> = Language::ALL
                    .iter()
                    .map(|&l| (l.as_str().to_string(), json!(s.starter_code(id, l).unwrap())))
                    .collect();
                json!({ "signature": p.signature, "inPlaceArg": p.in_place_arg, "code": code })
            })
            .collect();

    let v = |x: &dyn erased::Ser| x.to_value();
    let fixture = json!({
        "problemPack": v(&pack),
        "exportProblemPack": v(&exported),
        "importProblemPack": v(&pack_import),
        "starterCode": starter,
        "mentorEvents": v(&mentor_events),
        "importProblem": v(&imported),
        "generateQuestions": v(&generated),
        "testConnection": v(&connection),
        "listModels": v(&models),
        "listProblems": v(&s.list_problems().unwrap()),
        "getProblem": v(&s.get_problem("two-sum").unwrap()),
        "getStats": v(&s.get_stats().unwrap()),
        "getDashboard": v(&s.get_dashboard().unwrap()),
        "getDraft": v(&s.get_draft("two-sum", Language::Python).unwrap()),
        "runCode": [v(&run), v(&failed), v(&compile_error)],
        "submitCode": v(&submit),
        "listSubmissions": v(&s.list_submissions("two-sum").unwrap()),
        "getSettings": v(&s.get_settings().unwrap()),
        "detectRuntimes": v(&s.detect_runtimes()),
        "dataInfo": v(&s.data_info().unwrap()),
        "listAiProfiles": v(&vec![profile]),
        "listChat": v(&s.list_chat("two-sum").unwrap()),
        "listBankQuestions": v(&s.list_bank_questions().unwrap()),
        "getQuestion": v(&s.get_question(&question.id).unwrap()),
        "verifyReference": v(&verify),
        "listCategories": v(&s.list_categories().unwrap()),
        "saveCategory": v(&category),
        "listPlans": v(&s.list_plans().unwrap()),
        "getPlan": v(&s.get_plan(&plan.id).unwrap()),
    });

    /// Keeps the structure, blanks the values: what the frontend schemas care about.
    fn shape(v: &Value) -> Value {
        match v {
            Value::Object(m) => Value::Object(m.iter().map(|(k, x)| (k.clone(), shape(x))).collect::<Map<_, _>>()),
            Value::Array(xs) => Value::Array(xs.iter().take(1).map(shape).collect()),
            Value::String(_) => json!("string"),
            Value::Number(_) => json!(0),
            other => other.clone(),
        }
    }
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/desktop/src/api/backend-contract.json");
    if std::env::var_os("UPDATE_CONTRACT").is_some() {
        std::fs::write(&path, serde_json::to_string_pretty(&fixture).unwrap() + "\n").unwrap();
        return;
    }
    let committed: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    // Runtimes depend on the machine, so only their presence is compared.
    let strip = |mut v: Value| {
        v["detectRuntimes"] = json!([]);
        shape(&v)
    };
    assert_eq!(fixture["starterCode"], committed["starterCode"], "starter code changed: rerun with UPDATE_CONTRACT=1");
    assert_eq!(strip(fixture), strip(committed), "backend responses changed shape: rerun with UPDATE_CONTRACT=1");
}

mod erased {
    pub trait Ser {
        fn to_value(&self) -> serde_json::Value;
    }
    impl<T: serde::Serialize> Ser for T {
        fn to_value(&self) -> serde_json::Value {
            serde_json::to_value(self).unwrap()
        }
    }
}

#[test]
fn problem_packs_round_trip_between_installs() {
    let a = service();
    let mine = a
        .save_category(&codegym_core::CategoryForm {
            id: None,
            name: "Warm-ups".into(),
            color: "green".into(),
            description: "Short ones".into(),
        })
        .unwrap();
    let mut q = sum_question("class Solution:\n    def sumAll(self, nums):\n        return sum(nums)\n");
    q.category_ids = vec!["array".into(), mine.id.clone()];
    a.create_question(&q).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("mine.codegym.json");
    let exported = a.export_problem_pack(&file).unwrap();
    assert_eq!(exported.questions, 1);

    // A different install: no "Warm-ups" category yet.
    let b = service();
    let result = b.import_problem_pack(&file).unwrap();
    assert_eq!((result.imported, result.categories_created), (1, 1), "{result:?}");
    let imported = b.list_bank_questions().unwrap().into_iter().find(|q| q.summary.title == "Sum All").unwrap();
    assert!(imported.verified, "the reference is run on import");
    let names: Vec<String> = imported.summary.categories.iter().map(|c| c.name.clone()).collect();
    assert_eq!(names.len(), 2, "{names:?}");

    // Importing again skips duplicates; broken entries are reported, not fatal.
    let again = b.import_problem_pack(&file).unwrap();
    assert_eq!(again.imported, 0);
    assert!(again.skipped[0].reason.contains("already"));
    let mut pack = a.problem_pack().unwrap();
    pack.questions[0].title = "Broken".into();
    pack.questions[0].tests.truncate(1);
    let broken = b.import_pack_text(&serde_json::to_string(&pack).unwrap()).unwrap();
    assert_eq!(broken.skipped[0].title, "Broken");

    assert!(b.import_pack_text("{\"format\": \"something-else\"}").is_err());
    assert!(matches!(service().export_problem_pack(&file), Err(ServiceError::Invalid(_))), "nothing to export");
}
