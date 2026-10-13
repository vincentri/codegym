//! Checks every built-in problem: its tests are well formed, its reference solution passes in
//! every language, and the starter code runs without harness errors.
//!
//! Reads `problems/` from disk so a single problem can be checked while it's being written:
//!   CODEGYM_PROBLEMS=two-sum,valid-anagram cargo test -p codegym-runner --test bank -- --nocapture
//! and to a subset of languages with CODEGYM_LANGUAGES=java,rust.

use std::collections::BTreeSet;
use std::path::PathBuf;
use std::time::Duration;

use codegym_core::bank::BankProblem;
use codegym_core::values::fits;
use codegym_core::{Language, Verdict};
use codegym_runner::{Limits, RunCase, RunSpec, Runner, RunnerConfig, Trust, starter_code_for};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn runner() -> Runner {
    let python = root().join("apps/desktop/src-tauri/resources/python");
    Runner::new(RunnerConfig {
        python_dir: python.join("python.wasm").is_file().then_some(python),
        cache_dir: Some(root().join("target/wasmtime-cache")),
        force_quickjs: false,
    })
}

fn problem_ids_on_disk() -> BTreeSet<String> {
    std::fs::read_dir(root().join("problems"))
        .unwrap()
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter_map(|n| n.strip_suffix(".json").map(str::to_string))
        .filter(|n| n != "bank")
        .collect()
}

fn selected() -> Vec<String> {
    match std::env::var("CODEGYM_PROBLEMS") {
        Ok(list) if !list.trim().is_empty() => list.split(',').map(|s| s.trim().to_string()).collect(),
        _ => problem_ids_on_disk().into_iter().collect(),
    }
}

fn languages() -> Vec<Language> {
    match std::env::var("CODEGYM_LANGUAGES") {
        Ok(list) if !list.trim().is_empty() => {
            list.split(',').map(|l| Language::parse(l.trim()).expect("unknown language")).collect()
        }
        _ => Language::ALL.to_vec(),
    }
}

fn check(runner: &Runner, id: &str) -> Vec<String> {
    let mut problems = Vec::new();
    let path = root().join(format!("problems/{id}.json"));
    let p: BankProblem = match std::fs::read(&path)
        .map_err(|e| e.to_string())
        .and_then(|b| serde_json::from_slice(&b).map_err(|e| e.to_string()))
    {
        Ok(p) => p,
        Err(e) => return vec![format!("{id}: can't read {}: {e}", path.display())],
    };
    let sig = &p.signature;
    if p.id != id {
        problems.push(format!("{id}: file declares id {}", p.id));
    }
    let visible = p.tests.iter().filter(|t| !t.hidden).count();
    if visible == 0 || p.tests.len() < 5 {
        problems.push(format!("{id}: needs at least 1 visible test and 5 tests in all"));
    }
    let out_type = match p.in_place_arg {
        Some(k) => sig.params.get(k).map(|p| p.ty),
        None => Some(sig.returns),
    };
    for (i, t) in p.tests.iter().enumerate() {
        if t.input.len() != sig.params.len() {
            problems.push(format!("{id}: test {i} has {} inputs, expected {}", t.input.len(), sig.params.len()));
            continue;
        }
        for (param, v) in sig.params.iter().zip(&t.input) {
            if !fits(param.ty, v) {
                problems.push(format!("{id}: test {i}: {} = {v} isn't a {:?}", param.name, param.ty));
            }
        }
        if let Some(ty) = out_type
            && !fits(ty, &t.expected)
        {
            problems.push(format!("{id}: test {i}: expected {} isn't a {ty:?}", t.expected));
        }
    }
    let spec = RunSpec {
        signature: sig.clone(),
        comparator: p.comparator,
        in_place_arg: p.in_place_arg,
        cases: p
            .tests
            .iter()
            .map(|t| RunCase { input: t.input.clone(), expected: Some(t.expected.clone()), hidden: false })
            .collect(),
    };
    let limits = Limits { timeout: Duration::from_secs(20), memory_mb: 512 };
    for language in languages() {
        let file = root().join(format!("problems/solutions/{}/{id}.{}", language.as_str(), language.extension()));
        let Ok(code) = std::fs::read_to_string(&file) else {
            problems.push(format!("{id}: missing {}", file.display()));
            continue;
        };
        let result = runner.run(language, &code, &spec, limits, Trust::User);
        if result.verdict != Verdict::Accepted {
            let detail = result
                .results
                .iter()
                .find(|r| r.passed != Some(true))
                .map(|r| {
                    format!(
                        "test {}: input {:?} expected {:?} got {:?} error {:?}",
                        r.index, r.input, r.expected, r.actual, r.error
                    )
                })
                .or(result.compile_output.clone())
                .unwrap_or_default();
            problems.push(format!("{id} [{}]: {:?} — {detail}", language.as_str(), result.verdict));
        }
        // Starter code in compiled languages has an empty body that doesn't compile yet.
        if matches!(language, Language::Javascript | Language::Python | Language::Typescript) {
            let starter =
                runner.run(language, &starter_code_for(sig, p.in_place_arg, language), &spec, limits, Trust::User);
            let harness_error = starter.compile_output.is_some()
                || starter.results.iter().any(|r| r.error.as_deref().is_some_and(|e| !e.contains("Time limit")));
            if harness_error {
                problems.push(format!("{id} [{}]: starter code errors: {starter:#?}", language.as_str()));
            }
        }
    }
    problems
}

#[test]
fn every_problem_passes_with_its_reference_solutions() {
    let runner = runner();
    let failures: Vec<String> = selected().iter().flat_map(|id| check(&runner, id)).collect();
    assert!(failures.is_empty(), "\n{}\n", failures.join("\n\n"));
    println!("checked {} problems", selected().len());
}

#[test]
fn bank_index_lists_every_problem() {
    if std::env::var("CODEGYM_PROBLEMS").is_ok() {
        return;
    }
    let bank = codegym_core::bank::load().expect("bank loads");
    let listed: BTreeSet<String> = bank.problems.iter().map(|p| p.id.clone()).collect();
    assert_eq!(listed, problem_ids_on_disk(), "bank.json `problems` must list every problems/*.json");
    for p in &bank.problems {
        assert_eq!(p.references.len(), Language::ALL.len(), "{} needs a reference solution in each language", p.id);
    }
    let plan = &bank.plans[0];
    assert_eq!(
        plan.problem_ids.iter().collect::<BTreeSet<_>>(),
        listed.iter().collect(),
        "the starter plan covers the bank"
    );
}
