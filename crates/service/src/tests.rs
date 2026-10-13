use std::path::PathBuf;

use codegym_core::{
    Comparator, Difficulty, Language, Param, ParamType, ProblemOrigin, ProblemStatus, QuestionInput, ReferenceSolution,
    RunRequest, Signature, Store, TestCase, Verdict, VerifyRequest, VerifyTest,
};
use codegym_runner::{RunnerConfig, Trust};
use serde_json::json;

use super::*;

fn service() -> Service {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let python = root.join("apps/desktop/src-tauri/resources/python");
    Service::new(
        Store::open_in_memory().unwrap(),
        RunnerConfig {
            python_dir: python.join("python.wasm").is_file().then_some(python),
            cache_dir: Some(root.join("target/wasmtime-cache")),
            force_quickjs: false,
        },
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
#[test]
fn contract_fixture_is_up_to_date() {
    use serde_json::{Map, Value};
    let s = service();
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
        .save_ai_profile(
            &codegym_core::AiProfileForm {
                id: None,
                provider: "ollama".into(),
                name: "Local".into(),
                base_url: "http://localhost:11434/v1".into(),
                model: "qwen2.5-coder".into(),
                api_key: String::new(),
                has_stored_key: false,
                effort: "medium".into(),
                mentor_style: "socratic".into(),
            },
            false,
        )
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

    let v = |x: &dyn erased::Ser| x.to_value();
    let fixture = json!({
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
