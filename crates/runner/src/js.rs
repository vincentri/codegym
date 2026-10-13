//! JavaScript: system Node.js, or QuickJS built into the app.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use codegym_core::RunResult;
use rquickjs::context::EvalOptions;
use rquickjs::{CatchResultExt, CaughtError, Context, Function, Runtime};

use crate::outcome::{self, Raw};
use crate::process::{self, OUTPUT_CAP, Tool};
use crate::{Limits, RunSpec, nonce, payload};

const HARNESS: &str = include_str!("harness/harness.js");

/// The solver's code first (so line numbers match the editor), then the harness.
fn script(code: &str, spec: &RunSpec) -> String {
    let name = &spec.signature.function_name;
    let lookup = format!("(typeof {name} === \"function\" ? {name} : undefined)");
    format!("{code}\n{}", HARNESS.replace("__CODEGYM_FN__", &lookup))
}

fn user_lines(code: &str) -> usize {
    code.lines().count().max(1)
}

/// `remap` rewrites error locations (TypeScript maps them back to its own lines).
pub fn run_node(node: &Tool, code: &str, spec: &RunSpec, limits: Limits, remap: &dyn Fn(&str) -> String) -> RunResult {
    let dir = match tempfile::Builder::new().prefix("codegym-js").tempdir() {
        Ok(d) => d,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't create a temp folder: {e}")),
    };
    let file = dir.path().join("solution.js");
    if let Err(e) = std::fs::write(&file, script(code, spec)) {
        return outcome::internal_error(spec, format!("Couldn't write the solution: {e}"));
    }
    let nonce = nonce();
    let mut cmd = node.command();
    cmd.arg(format!("--max-old-space-size={}", limits.memory_mb));
    // Room for deep recursion, within the 8 MB main-thread stack Linux and macOS give Node.
    if !cfg!(windows) {
        cmd.arg("--stack-size=4000");
    }
    cmd.arg("solution.js").current_dir(dir.path()).env_remove("NODE_OPTIONS");
    let input = payload(spec, &nonce, user_lines(code), None);
    let out = match process::run(cmd, input.as_bytes(), limits.timeout) {
        Ok(o) => o,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't start Node.js: {e}")),
    };
    let prefix = format!("{}{}", dir.path().display(), std::path::MAIN_SEPARATOR);
    let clean = |s: &str| remap(&clean_node(&s.replace(&format!("file://{prefix}"), "").replace(&prefix, "")));
    let raw = Raw {
        stdout: out.stdout,
        stderr: out.stderr,
        timed_out: out.timed_out,
        output_limited: out.output_limited,
        crash: None,
    };
    outcome::assemble(spec, &raw, &nonce, limits.timeout, &clean)
}

/// Drops Node's own stack frames and banner from an error message.
fn clean_node(text: &str) -> String {
    text.lines()
        .filter(|l| {
            let t = l.trim_start();
            !(t.starts_with("at ") && (t.contains("node:") || !t.contains("solution.js")))
                && !t.starts_with("Node.js v")
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

/// Runs in QuickJS on its own thread, with a memory cap and a deadline checked by QuickJS's
/// interrupt handler. QuickJS has no file, network or process APIs, so this is the sandbox
/// for code the user didn't write.
pub fn run_quickjs(code: &str, spec: &RunSpec, limits: Limits, remap: &dyn Fn(&str) -> String) -> RunResult {
    let nonce = nonce();
    let source = script(code, spec);
    let input = payload(spec, &nonce, user_lines(code), None);
    let timeout = limits.timeout;
    let memory = (limits.memory_mb as usize) << 20;

    let worker = thread::Builder::new().stack_size(64 << 20).spawn(move || -> Raw {
        let output = Arc::new(Mutex::new(String::new()));
        let timed_out = Arc::new(AtomicBool::new(false));
        let too_long = Arc::new(AtomicBool::new(false));
        let mut raw = Raw::default();
        let (rt, ctx) = match Runtime::new().and_then(|rt| Context::full(&rt).map(|c| (rt, c))) {
            Ok(v) => v,
            Err(e) => {
                raw.crash = Some(format!("QuickJS failed to start: {e}"));
                return raw;
            }
        };
        rt.set_memory_limit(memory);
        rt.set_max_stack_size(16 << 20);
        let deadline = Instant::now() + timeout;
        let (t, l) = (timed_out.clone(), too_long.clone());
        rt.set_interrupt_handler(Some(Box::new(move || {
            if Instant::now() >= deadline {
                t.store(true, Ordering::Relaxed);
            }
            t.load(Ordering::Relaxed) || l.load(Ordering::Relaxed)
        })));
        ctx.with(|ctx| {
            let sink = output.clone();
            let limit = too_long.clone();
            let emit = Function::new(ctx.clone(), move |line: String| {
                let mut buf = sink.lock().unwrap_or_else(|e| e.into_inner());
                if buf.len() + line.len() > OUTPUT_CAP {
                    limit.store(true, Ordering::Relaxed);
                    return;
                }
                buf.push_str(&line);
                buf.push('\n');
            });
            let globals = ctx.globals();
            let setup =
                emit.and_then(|f| globals.set("__codegym_emit", f)).and_then(|_| globals.set("__codegym_input", input));
            if let Err(e) = setup {
                raw.crash = Some(format!("QuickJS setup failed: {e}"));
                return;
            }
            let mut options = EvalOptions::default();
            options.strict = false;
            options.filename = Some("solution.js".into());
            if let Err(err) = ctx.eval_with_options::<(), _>(source, options).catch(&ctx) {
                let text = match err {
                    CaughtError::Exception(e) => {
                        let name: String = e.get("name").unwrap_or_else(|_| "Error".into());
                        let message = e.message().unwrap_or_default();
                        let stack = e.stack().unwrap_or_default();
                        format!("{name}: {message}\n{stack}")
                    }
                    other => other.to_string(),
                };
                if text.contains("SyntaxError") {
                    raw.stderr = text;
                } else if !outcome::is_memory(&text) && rt.memory_usage().malloc_size as usize >= memory / 10 * 9 {
                    // Out of memory, QuickJS may fail to allocate even the error and throw `null`
                    // (seen on macOS); the heap being at its limit tells us what happened.
                    raw.crash = Some(format!("InternalError: out of memory\n{text}"));
                } else {
                    raw.crash = Some(text);
                }
            }
        });
        raw.stdout = std::mem::take(&mut *output.lock().unwrap_or_else(|e| e.into_inner()));
        raw.timed_out = timed_out.load(Ordering::Relaxed);
        raw.output_limited = too_long.load(Ordering::Relaxed);
        if raw.timed_out || raw.output_limited {
            raw.crash = None;
        }
        raw
    });
    let raw = match worker.map(|h| h.join()) {
        Ok(Ok(raw)) => raw,
        _ => return outcome::internal_error(spec, "The JavaScript sandbox crashed.".into()),
    };
    let clean = |s: &str| remap(s.trim());
    outcome::assemble(spec, &raw, &nonce, timeout, &clean)
}
