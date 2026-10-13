use serde_json::json;

use super::*;
use crate::types::*;

fn run(verdict: Verdict, passed: usize, total: usize) -> RunResult {
    RunResult { verdict, passed, total, results: vec![], compile_output: None, total_time_ms: 12.0 }
}

fn custom_question(title: &str) -> QuestionInput {
    QuestionInput {
        title: title.into(),
        difficulty: Difficulty::Easy,
        category_ids: vec!["array".into()],
        description_md: "Return the sum of the numbers in the array.".into(),
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
            TestCase { input: vec![json!([-1, 1])], expected: json!(0), hidden: true },
        ],
        reference: Some(ReferenceSolution {
            language: Language::Javascript,
            code: "function sumAll(nums) { return nums.reduce((a, b) => a + b, 0); }".into(),
        }),
        origin: ProblemOrigin::Manual,
        forked_from: None,
    }
}

#[test]
fn syncs_the_builtin_bank_on_open() {
    let store = Store::open_in_memory().unwrap();
    let problems = store.list_problems().unwrap();
    assert!(problems.iter().any(|p| p.id == "two-sum" && p.origin == ProblemOrigin::Builtin));
    let two_sum = store.get_problem("two-sum").unwrap();
    assert_eq!(two_sum.examples.len() + two_sum.hidden_test_count, store.tests("two-sum").unwrap().len());
    assert!(!store.references("two-sum").unwrap().is_empty());
    assert!(store.list_plans().unwrap().iter().any(|p| p.builtin));
}

#[test]
fn passing_submit_writes_submission_solve_progress_and_events() {
    let mut store = Store::open_in_memory().unwrap();
    store.record_activity(&ActivityEvent::ProblemOpened { problem_id: "two-sum".into() }).unwrap();
    store
        .record_activity(&ActivityEvent::SessionHeartbeat { problem_id: "two-sum".into(), active_seconds: 90 })
        .unwrap();
    store.record_mentor_use("two-sum", "hint").unwrap();
    store.record_mentor_use("two-sum", "hint").unwrap();

    let (_, first) =
        store.record_submission("two-sum", Language::Python, "x", &run(Verdict::WrongAnswer, 3, 8)).unwrap();
    assert!(!first);
    assert_eq!(store.summary("two-sum").unwrap().status, ProblemStatus::Attempted);
    let solves: i64 = store.conn.query_row("SELECT COUNT(*) FROM solves", [], |r| r.get(0)).unwrap();
    assert_eq!(solves, 0, "a failed submit writes no solve");

    let (submission, first) =
        store.record_submission("two-sum", Language::Python, "y", &run(Verdict::Accepted, 8, 8)).unwrap();
    assert!(first);
    assert_eq!(submission.verdict, Verdict::Accepted);
    assert_eq!(store.summary("two-sum").unwrap().status, ProblemStatus::Solved);

    let (attempts, hints, time, first_flag): (i64, i64, i64, bool) = store
        .conn
        .query_row("SELECT attempts_before_solve, hints_used, time_spent_sec, is_first_solve FROM solves", [], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .unwrap();
    assert_eq!((attempts, hints, time, first_flag), (1, 2, 90, true));

    let (_, again) = store.record_submission("two-sum", Language::Go, "z", &run(Verdict::Accepted, 8, 8)).unwrap();
    assert!(!again, "a second solve is not a first solve");
    let firsts: i64 =
        store.conn.query_row("SELECT COUNT(*) FROM solves WHERE is_first_solve = 1", [], |r| r.get(0)).unwrap();
    assert_eq!(firsts, 1);
    // Later failures never downgrade a solved problem.
    store.record_submission("two-sum", Language::Go, "w", &run(Verdict::WrongAnswer, 1, 8)).unwrap();
    assert_eq!(store.summary("two-sum").unwrap().status, ProblemStatus::Solved);
    assert_eq!(store.stats().unwrap().streak_days, 1);
    assert_eq!(store.list_submissions("two-sum").unwrap().len(), 4);
}

#[test]
fn question_crud_and_builtin_protection() {
    let mut store = Store::open_in_memory().unwrap();
    let q = store.create_question(&custom_question("Sum All")).unwrap();
    assert_eq!(q.id, "sum-all");
    let again = store.create_question(&custom_question("Sum All")).unwrap();
    assert_eq!(again.id, "sum-all-2");

    let mut edited = custom_question("Sum Everything");
    edited.tests.push(TestCase { input: vec![json!([5])], expected: json!(5), hidden: true });
    let updated = store.update_question("sum-all", &edited).unwrap();
    assert_eq!(updated.input.title, "Sum Everything");
    assert_eq!(updated.input.tests.len(), 4);

    let builtin = store.get_question("two-sum").unwrap();
    assert!(store.update_question("two-sum", &builtin.input).is_err());
    assert!(store.delete_questions(&["two-sum".into()]).is_err());

    store.save_draft("sum-all", Language::Python, "code").unwrap();
    store.delete_questions(&["sum-all".into()]).unwrap();
    assert!(store.get_question("sum-all").is_err());
    assert!(store.draft("sum-all", Language::Python).unwrap().is_none());
}

#[test]
fn rejects_invalid_questions() {
    let mut store = Store::open_in_memory().unwrap();
    let mut q = custom_question("Bad");
    q.tests.iter_mut().for_each(|t| t.hidden = true);
    assert!(store.create_question(&q).is_err());
    let mut q = custom_question("Bad tests");
    q.tests[0].input.push(json!(1));
    assert!(store.create_question(&q).is_err());
}

#[test]
fn hidden_questions_leave_problems_but_stay_in_bank() {
    let store = Store::open_in_memory().unwrap();
    store.set_hidden(&["two-sum".into()], true).unwrap();
    assert!(!store.list_problems().unwrap().iter().any(|p| p.id == "two-sum"));
    assert!(store.list_bank_questions().unwrap().iter().any(|q| q.summary.id == "two-sum" && q.summary.hidden));
}

#[test]
fn categories_crud() {
    let mut store = Store::open_in_memory().unwrap();
    let form =
        |name: &str| CategoryForm { id: None, name: name.into(), color: "green".into(), description: String::new() };
    let c = store.save_category(&form("Warm-ups")).unwrap();
    assert!(store.save_category(&form("warm-ups")).is_err(), "names are unique ignoring case");
    assert!(store.delete_category("array").is_err(), "built-ins are protected");

    store.set_question_categories(&["two-sum".into()], std::slice::from_ref(&c.id), &[]).unwrap();
    assert!(store.get_question("two-sum").unwrap().input.category_ids.contains(&c.id));
    store.delete_category(&c.id).unwrap();
    assert!(store.get_question("two-sum").is_ok(), "deleting a category keeps its questions");
    assert!(!store.get_question("two-sum").unwrap().input.category_ids.contains(&c.id));
}

#[test]
fn plans_order_progress_and_builtin_protection() {
    let mut store = Store::open_in_memory().unwrap();
    let mine = store.create_question(&custom_question("Sum All")).unwrap();
    let plan = store.save_plan(&PlanForm { id: None, name: "Week 1".into(), description: String::new() }).unwrap();
    store.set_plan_items(&plan.id, &["two-sum".into(), mine.id.clone(), "two-sum".into()]).unwrap();
    let detail = store.get_plan(&plan.id).unwrap();
    assert_eq!(detail.items.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(), ["two-sum", "sum-all"]);
    assert_eq!(detail.summary.next.as_ref().unwrap().id, "two-sum");

    store.record_submission("two-sum", Language::Javascript, "x", &run(Verdict::Accepted, 8, 8)).unwrap();
    let detail = store.get_plan(&plan.id).unwrap();
    assert_eq!((detail.summary.solved, detail.summary.next.unwrap().id), (1, "sum-all".to_string()));

    assert!(store.set_plan_items("interview-essentials", &[]).is_err());
    let copy = store.duplicate_plan("interview-essentials").unwrap();
    assert!(!copy.builtin);
    store.delete_plan(&copy.id).unwrap();
}

#[test]
fn reset_keeps_settings_categories_and_plans() {
    let mut store = Store::open_in_memory().unwrap();
    let mine = store.create_question(&custom_question("Sum All")).unwrap();
    store
        .save_category(&CategoryForm { id: None, name: "Mine".into(), color: "red".into(), description: String::new() })
        .unwrap();
    let plan = store.save_plan(&PlanForm { id: None, name: "Week 1".into(), description: String::new() }).unwrap();
    store.update_settings(&AppSettings { autosave_seconds: 30, ..Default::default() }).unwrap();
    store.record_submission("two-sum", Language::Python, "x", &run(Verdict::Accepted, 8, 8)).unwrap();
    store.save_draft("two-sum", Language::Python, "draft").unwrap();

    store.reset_progress(false).unwrap();
    assert_eq!(store.stats().unwrap().solved, 0);
    assert!(store.draft("two-sum", Language::Python).unwrap().is_none());
    assert!(store.get_question(&mine.id).is_ok());
    assert!(store.list_categories().unwrap().iter().any(|c| c.name == "Mine"));
    assert!(store.get_plan(&plan.id).is_ok());
    assert_eq!(store.settings().unwrap().autosave_seconds, 30);

    store.reset_progress(true).unwrap();
    assert!(store.get_question(&mine.id).is_err());
    assert!(store.get_question("two-sum").is_ok());
}

#[test]
fn settings_are_validated() {
    let store = Store::open_in_memory().unwrap();
    assert_eq!(store.settings().unwrap().autosave_seconds, 5);
    assert!(store.update_settings(&AppSettings { autosave_seconds: 301, ..Default::default() }).is_err());
}

#[test]
fn json_shape_matches_the_frontend() {
    let store = Store::open_in_memory().unwrap();
    let p = serde_json::to_value(store.get_problem("two-sum").unwrap()).unwrap();
    for key in [
        "id",
        "number",
        "title",
        "difficulty",
        "categories",
        "origin",
        "hidden",
        "status",
        "descriptionMd",
        "signature",
        "comparator",
        "inPlaceArg",
        "examples",
        "hiddenTestCount",
    ] {
        assert!(p.get(key).is_some(), "missing {key}");
    }
    assert_eq!(p["signature"]["params"][0]["type"], "int[]");
    assert_eq!(p["origin"], "builtin");
}
