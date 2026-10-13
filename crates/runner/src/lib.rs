//! Runs a solution against test cases.
//!
//! Every language uses the same protocol: the runner sends a JSON payload (the signature, the
//! test inputs and a random nonce) on stdin, and a harness wrapped around the solver's code
//! answers with one `@@CODEGYM:<nonce>@@{json}` line per test. Answers are compared here in
//! Rust, so all languages share one comparator. Results stream line by line, so when a run is
//! killed for taking too long we still know which test hung.
//!
//! Engines:
//! - JavaScript: system Node.js when installed, otherwise QuickJS built into the app. Code that
//!   the user didn't write (AI-generated references) always runs in QuickJS.
//! - Python: CPython compiled to WebAssembly, run in wasmtime with no file or network access;
//!   system `python3` when the WebAssembly build isn't available.
//! - Go: the system Go toolchain.

mod go;
mod js;
mod outcome;
mod process;
mod python;
mod starter;

use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;

use codegym_core::values::is_identifier;
use codegym_core::{Comparator, Language, RunResult, RuntimeInfo, Signature};
use serde_json::Value;

pub use starter::starter_code;

/// One test to run. `expected` is `None` for custom inputs, which are run but not graded.
#[derive(Debug, Clone)]
pub struct RunCase {
    pub input: Vec<Value>,
    pub expected: Option<Value>,
    pub hidden: bool,
}

#[derive(Debug, Clone)]
pub struct RunSpec {
    pub signature: Signature,
    pub comparator: Comparator,
    pub in_place_arg: Option<usize>,
    pub cases: Vec<RunCase>,
}

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    /// Wall-clock limit for the whole run (compiling Go is not counted).
    pub timeout: Duration,
    pub memory_mb: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Self { timeout: Duration::from_secs(10), memory_mb: 512 }
    }
}

/// Who wrote the code. Untrusted code (AI-generated) only runs in the built-in sandboxes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trust {
    User,
    Untrusted,
}

#[derive(Debug, Clone, Default)]
pub struct RunnerConfig {
    /// Folder holding `python.wasm` and `lib/python3.12/`. `None` uses system Python.
    pub python_dir: Option<PathBuf>,
    /// Where wasmtime caches compiled machine code between launches.
    pub cache_dir: Option<PathBuf>,
    /// Ignore system Node.js and always use QuickJS (used by tests).
    pub force_quickjs: bool,
}

pub struct Runner {
    config: RunnerConfig,
    node: OnceLock<Option<process::Tool>>,
    go: OnceLock<Option<process::Tool>>,
    python_system: OnceLock<Option<process::Tool>>,
    python_wasi: OnceLock<Result<python::Wasi, String>>,
}

impl Runner {
    pub fn new(config: RunnerConfig) -> Self {
        Self {
            config,
            node: OnceLock::new(),
            go: OnceLock::new(),
            python_system: OnceLock::new(),
            python_wasi: OnceLock::new(),
        }
    }

    fn node(&self) -> Option<&process::Tool> {
        if self.config.force_quickjs {
            return None;
        }
        self.node.get_or_init(|| process::Tool::detect(&["node"], &["--version"])).as_ref()
    }

    fn go(&self) -> Option<&process::Tool> {
        self.go.get_or_init(|| process::Tool::detect(&["go"], &["version"])).as_ref()
    }

    fn python_system(&self) -> Option<&process::Tool> {
        self.python_system.get_or_init(|| process::Tool::detect(&["python3", "python"], &["--version"])).as_ref()
    }

    fn python_wasi(&self) -> Option<&python::Wasi> {
        let dir = self.config.python_dir.as_ref()?;
        self.python_wasi.get_or_init(|| python::Wasi::load(dir, self.config.cache_dir.as_deref())).as_ref().ok()
    }

    /// Compiles the Python WebAssembly module ahead of the first run (it takes a few seconds
    /// the first time; later launches load it from the cache).
    pub fn warm_up(&self) {
        let _ = self.python_wasi();
    }

    pub fn run(&self, language: Language, code: &str, spec: &RunSpec, limits: Limits, trust: Trust) -> RunResult {
        if let Err(message) = validate(spec) {
            return outcome::internal_error(spec, message);
        }
        match language {
            Language::Javascript => match (trust, self.node()) {
                (Trust::User, Some(node)) => js::run_node(node, code, spec, limits),
                _ => js::run_quickjs(code, spec, limits),
            },
            Language::Python => match (self.python_wasi(), trust) {
                (Some(wasi), _) => wasi.run(code, spec, limits),
                (None, Trust::User) => match self.python_system() {
                    Some(py) => python::run_system(py, code, spec, limits),
                    None => outcome::internal_error(spec, self.python_missing()),
                },
                (None, Trust::Untrusted) => outcome::internal_error(spec, self.python_missing()),
            },
            Language::Go => match (trust, self.go()) {
                (Trust::User, Some(go)) => go::run(go, code, spec, limits),
                (Trust::Untrusted, _) => outcome::internal_error(
                    spec,
                    "Generated Go code isn't run outside the sandbox. Verify it with JavaScript or Python.".into(),
                ),
                (_, None) => outcome::internal_error(spec, GO_HINT.into()),
            },
        }
    }

    fn python_missing(&self) -> String {
        match self.python_wasi.get() {
            Some(Err(e)) => format!("The built-in Python couldn't start: {e}"),
            _ => PYTHON_HINT.into(),
        }
    }

    /// What each language runs on, for Settings → Languages.
    pub fn runtimes(&self) -> Vec<RuntimeInfo> {
        let js = match self.node() {
            Some(node) => RuntimeInfo {
                language: Language::Javascript,
                engine: "Node.js (system)".into(),
                version: Some(node.version.clone()),
                available: true,
                bundled: false,
                install_hint: None,
            },
            None => RuntimeInfo {
                language: Language::Javascript,
                engine: "QuickJS (built in)".into(),
                version: None,
                available: true,
                bundled: true,
                install_hint: Some("Install Node.js for faster runs and full Node APIs.".into()),
            },
        };
        let python = match (self.python_wasi(), self.python_system()) {
            (Some(_), _) => RuntimeInfo {
                language: Language::Python,
                engine: "CPython (WebAssembly, built in)".into(),
                version: Some(python::WASI_VERSION.into()),
                available: true,
                bundled: true,
                install_hint: None,
            },
            (None, Some(py)) => RuntimeInfo {
                language: Language::Python,
                engine: "Python (system)".into(),
                version: Some(py.version.clone()),
                available: true,
                bundled: false,
                install_hint: None,
            },
            (None, None) => RuntimeInfo {
                language: Language::Python,
                engine: "Python".into(),
                version: None,
                available: false,
                bundled: false,
                install_hint: Some(self.python_missing()),
            },
        };
        let go = match self.go() {
            Some(go) => RuntimeInfo {
                language: Language::Go,
                engine: "Go toolchain (system)".into(),
                version: Some(go.version.clone()),
                available: true,
                bundled: false,
                install_hint: None,
            },
            None => RuntimeInfo {
                language: Language::Go,
                engine: "Go toolchain (system)".into(),
                version: None,
                available: false,
                bundled: false,
                install_hint: Some(GO_HINT.into()),
            },
        };
        vec![python, js, go]
    }
}

const GO_HINT: &str = "Install Go from https://go.dev/dl/ and restart CodeGym.";
const PYTHON_HINT: &str = "Install Python 3 from https://www.python.org/downloads/ and restart CodeGym.";

/// The harnesses splice names into generated code, so they must be plain identifiers.
fn validate(spec: &RunSpec) -> Result<(), String> {
    let sig = &spec.signature;
    if !is_identifier(&sig.function_name) {
        return Err(format!("`{}` isn't a valid function name", sig.function_name));
    }
    if let Some(p) = sig.params.iter().find(|p| !is_identifier(&p.name)) {
        return Err(format!("`{}` isn't a valid parameter name", p.name));
    }
    if let Some(k) = spec.in_place_arg
        && k >= sig.params.len()
    {
        return Err("the in-place argument doesn't exist".into());
    }
    if let Some(i) = spec.cases.iter().position(|c| c.input.len() != sig.params.len()) {
        return Err(format!(
            "test {} has {} inputs but the function takes {}",
            i + 1,
            spec.cases[i].input.len(),
            sig.params.len()
        ));
    }
    Ok(())
}

fn payload(spec: &RunSpec, nonce: &str, user_lines: usize, code: Option<&str>) -> String {
    let sig = &spec.signature;
    serde_json::json!({
        "nonce": nonce,
        "fn": sig.function_name,
        "params": sig.params.iter().map(|p| p.ty).collect::<Vec<_>>(),
        "returns": sig.returns,
        "inPlace": spec.in_place_arg,
        "tests": spec.cases.iter().map(|c| &c.input).collect::<Vec<_>>(),
        "userLines": user_lines,
        "code": code,
    })
    .to_string()
}

fn nonce() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

#[cfg(test)]
mod tests;
