//! Turns what a harness printed into a [`RunResult`].

use std::collections::HashMap;
use std::time::Duration;

use codegym_core::compare::answers_match;
use codegym_core::{RunResult, TestResult, Verdict};
use serde_json::Value;

use crate::RunSpec;

/// What an engine saw while running the harness.
#[derive(Debug, Default)]
pub struct Raw {
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
    pub output_limited: bool,
    /// Why the program died, when the engine knows better than stderr (e.g. a wasm trap).
    pub crash: Option<String>,
}

pub(crate) fn is_memory(text: &str) -> bool {
    ["MemoryError", "out of memory", "Allocation failed", "memory limit"].iter().any(|s| text.contains(s))
}

fn tail(text: &str, max: usize) -> &str {
    let text = text.trim();
    if text.len() <= max {
        return text;
    }
    let mut start = text.len() - max;
    while !text.is_char_boundary(start) {
        start += 1;
    }
    &text[start..]
}

fn empty(spec: &RunSpec, verdict: Verdict, output: String) -> RunResult {
    RunResult {
        verdict,
        passed: 0,
        total: spec.cases.iter().filter(|c| c.expected.is_some()).count(),
        results: vec![],
        compile_output: Some(output),
        total_time_ms: 0.0,
    }
}

pub fn internal_error(spec: &RunSpec, message: String) -> RunResult {
    empty(spec, Verdict::InternalError, message)
}

pub fn compile_error(spec: &RunSpec, output: String) -> RunResult {
    empty(spec, Verdict::CompileError, output)
}

struct Record {
    ok: bool,
    value: Value,
    error: String,
    out: String,
    ms: f64,
}

/// Builds the result. `clean` tidies error text (e.g. strips temp-folder paths).
pub fn assemble(
    spec: &RunSpec,
    raw: &Raw,
    nonce: &str,
    timeout: Duration,
    clean: &dyn Fn(&str) -> String,
) -> RunResult {
    let mark = format!("@@CODEGYM:{nonce}@@");
    let mut ready = false;
    let mut load_error: Option<(String, bool)> = None;
    let mut records: HashMap<usize, Record> = HashMap::new();
    let mut stray = String::new();

    for line in raw.stdout.lines() {
        let Some(pos) = line.find(&mark) else {
            stray.push_str(line);
            stray.push('\n');
            continue;
        };
        // A print without a trailing newline ends up in front of the marker.
        stray.push_str(&line[..pos]);
        let Ok(v) = serde_json::from_str::<Value>(&line[pos + mark.len()..]) else { continue };
        if v.get("ready").is_some() {
            ready = true;
            stray.clear();
        } else if let Some(err) = v.get("loadError").and_then(Value::as_str) {
            let out = v.get("out").and_then(Value::as_str).unwrap_or_default();
            let text = if out.is_empty() { clean(err) } else { format!("{out}\n{}", clean(err)) };
            load_error = Some((text, v.get("syntax").and_then(Value::as_bool).unwrap_or(false)));
        } else if let Some(i) = v.get("i").and_then(Value::as_u64) {
            let field = |k: &str| v.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
            records.insert(
                i as usize,
                Record {
                    ok: v.get("ok").and_then(Value::as_bool).unwrap_or(false),
                    value: v.get("value").cloned().unwrap_or(Value::Null),
                    error: field("error"),
                    out: std::mem::take(&mut stray) + &field("out"),
                    ms: v.get("ms").and_then(Value::as_f64).unwrap_or(0.0),
                },
            );
        }
    }

    if let Some((text, syntax)) = load_error {
        return empty(spec, if syntax { Verdict::CompileError } else { Verdict::RuntimeError }, text);
    }
    if !ready {
        let stderr = clean(tail(&raw.stderr, 8000));
        let detail = raw.crash.clone().unwrap_or_default();
        return if raw.timed_out {
            empty(spec, Verdict::TimeLimit, "Time limit exceeded before the tests started.".into())
        } else if stderr.contains("SyntaxError") {
            empty(spec, Verdict::CompileError, stderr)
        } else {
            let text = [detail, stderr, stray.trim().to_string()]
                .into_iter()
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join("\n");
            let verdict = if is_memory(&text) { Verdict::MemoryLimit } else { Verdict::RuntimeError };
            let text = if text.is_empty() { "The program exited before running any tests.".into() } else { text };
            empty(spec, verdict, text)
        };
    }

    let mut results = Vec::with_capacity(spec.cases.len());
    let mut verdict = None;
    let mut stopped = false;
    for (index, case) in spec.cases.iter().enumerate() {
        let custom = case.expected.is_none();
        let mut r = TestResult {
            index,
            hidden: case.hidden,
            custom,
            input: (!case.hidden).then(|| case.input.clone()),
            expected: if case.hidden { None } else { case.expected.clone() },
            actual: None,
            passed: None,
            stdout: String::new(),
            error: None,
            time_ms: 0.0,
        };
        let fail = match records.remove(&index) {
            Some(rec) => {
                r.stdout = rec.out;
                r.time_ms = rec.ms;
                if rec.ok {
                    r.passed = case.expected.as_ref().map(|e| answers_match(spec.comparator, &rec.value, e));
                    if !case.hidden {
                        r.actual = Some(rec.value);
                    }
                    (r.passed == Some(false)).then_some(Verdict::WrongAnswer)
                } else {
                    let error = clean(&rec.error);
                    r.passed = (!custom).then_some(false);
                    let v = if is_memory(&error) { Verdict::MemoryLimit } else { Verdict::RuntimeError };
                    r.error = Some(error);
                    Some(v)
                }
            }
            None if !stopped => {
                stopped = true;
                r.passed = (!custom).then_some(false);
                r.stdout = std::mem::take(&mut stray);
                let (v, message) = if raw.timed_out {
                    (
                        Verdict::TimeLimit,
                        format!("Time limit exceeded: the run took longer than {}s.", timeout.as_secs()),
                    )
                } else if raw.output_limited {
                    (Verdict::RuntimeError, "Output limit exceeded: your program printed too much.".into())
                } else {
                    let text = [raw.crash.clone().unwrap_or_default(), clean(tail(&raw.stderr, 8000))]
                        .into_iter()
                        .filter(|s| !s.is_empty())
                        .collect::<Vec<_>>()
                        .join("\n");
                    let text = if text.is_empty() { "The program stopped unexpectedly.".into() } else { text };
                    (if is_memory(&text) { Verdict::MemoryLimit } else { Verdict::RuntimeError }, text)
                };
                r.error = Some(message);
                Some(v)
            }
            None => {
                r.error = Some("Not run: an earlier test stopped the program.".into());
                None
            }
        };
        if verdict.is_none() {
            verdict = fail;
        }
        results.push(r);
    }

    RunResult {
        verdict: verdict.unwrap_or(Verdict::Accepted),
        passed: results.iter().filter(|r| r.passed == Some(true)).count(),
        total: results.iter().filter(|r| !r.custom).count(),
        total_time_ms: results.iter().map(|r| r.time_ms).sum(),
        compile_output: None,
        results,
    }
}
