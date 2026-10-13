//! Python: CPython compiled to WebAssembly (WASI) running in wasmtime, or system Python.
//!
//! The WebAssembly build only sees its own standard library, mounted read-only. It has no other
//! files, no network and no clock beyond what WASI gives it, a memory cap, and a deadline
//! enforced with epoch interruption.

use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use codegym_core::RunResult;
use wasmtime::{
    Cache, CacheConfig, Config, Engine, InstancePre, Linker, Module, Store, StoreLimits, StoreLimitsBuilder, Trap,
};
use wasmtime_wasi::p1::{self, WasiP1Ctx};
use wasmtime_wasi::p2::pipe::{MemoryInputPipe, MemoryOutputPipe};
use wasmtime_wasi::{FsPerms, I32Exit, WasiCtxBuilder};

use crate::outcome::{self, Raw};
use crate::process::{self, OUTPUT_CAP, Tool};
use crate::{Limits, RunSpec, nonce, payload};

const HARNESS: &str = include_str!("harness/harness.py");
pub const WASI_VERSION: &str = "3.12";
const TICK: Duration = Duration::from_millis(10);

struct State {
    wasi: WasiP1Ctx,
    limits: StoreLimits,
}

pub struct Wasi {
    engine: Engine,
    pre: InstancePre<State>,
    lib: PathBuf,
}

impl Wasi {
    /// Compiles (or loads from the cache) `python.wasm` from `dir`, which also holds
    /// `lib/python3.12/`.
    pub fn load(dir: &Path, cache_dir: Option<&Path>) -> Result<Self, String> {
        let wasm = dir.join("python.wasm");
        let lib = dir.join("lib");
        if !wasm.is_file() || !lib.join(format!("python{WASI_VERSION}")).is_dir() {
            return Err(format!("{} is missing python.wasm or its standard library", dir.display()));
        }
        let mut config = Config::new();
        config.epoch_interruption(true).async_stack_size(16 << 20).max_wasm_stack(8 << 20);
        if let Some(cache_dir) = cache_dir {
            let mut cache = CacheConfig::new();
            cache.with_directory(cache_dir);
            if let Ok(cache) = Cache::new(cache) {
                config.cache(Some(cache));
            }
        }
        let engine = Engine::new(&config).map_err(|e| e.to_string())?;
        let module = Module::from_file(&engine, &wasm).map_err(|e| format!("can't load python.wasm: {e}"))?;
        let mut linker: Linker<State> = Linker::new(&engine);
        p1::add_to_linker_sync(&mut linker, |s: &mut State| &mut s.wasi).map_err(|e| e.to_string())?;
        let pre = linker.instantiate_pre(&module).map_err(|e| e.to_string())?;

        // One clock for every run: each run's deadline is counted in ticks of this clock.
        let weak = engine.weak();
        thread::Builder::new()
            .name("codegym-python-epoch".into())
            .spawn(move || {
                while let Some(engine) = weak.upgrade() {
                    engine.increment_epoch();
                    drop(engine);
                    thread::sleep(TICK);
                }
            })
            .map_err(|e| e.to_string())?;
        Ok(Self { engine, pre, lib })
    }

    pub fn run(&self, code: &str, spec: &RunSpec, limits: Limits) -> RunResult {
        let nonce = nonce();
        let input = payload(spec, &nonce, code.lines().count(), Some(code));
        let raw = thread::scope(|scope| {
            thread::Builder::new()
                .stack_size(64 << 20)
                .spawn_scoped(scope, || self.execute(input, limits))
                .map(|h| h.join())
        });
        let raw = match raw {
            Ok(Ok(Ok(raw))) => raw,
            Ok(Ok(Err(e))) => {
                return outcome::internal_error(spec, format!("The built-in Python failed to start: {e}"));
            }
            _ => return outcome::internal_error(spec, "The built-in Python crashed.".into()),
        };
        outcome::assemble(spec, &raw, &nonce, limits.timeout, &|s: &str| s.trim().to_string())
    }

    fn execute(&self, input: String, limits: Limits) -> Result<Raw, String> {
        let stdout = MemoryOutputPipe::new(OUTPUT_CAP);
        let stderr = MemoryOutputPipe::new(256 * 1024);
        let mut wasi = WasiCtxBuilder::new();
        wasi.stdin(MemoryInputPipe::new(input))
            .stdout(stdout.clone())
            .stderr(stderr.clone())
            .args(&["python", "-S", "-B", "-X", "utf8", "-c", HARNESS])
            .env("PYTHONHOME", "/")
            .env("PYTHONDONTWRITEBYTECODE", "1");
        wasi.preopened_dir(&self.lib, "/lib", FsPerms::ReadOnly).map_err(|e| e.to_string())?;
        let state = State {
            wasi: wasi.build_p1(),
            limits: StoreLimitsBuilder::new()
                .memory_size((limits.memory_mb as usize) << 20)
                .trap_on_grow_failure(false)
                .build(),
        };
        let mut store = Store::new(&self.engine, state);
        store.limiter(|s| &mut s.limits);
        store.set_epoch_deadline((limits.timeout.as_millis() / TICK.as_millis()) as u64 + 1);
        store.epoch_deadline_trap();

        let instance = self.pre.instantiate(&mut store).map_err(|e| e.to_string())?;
        let start = instance.get_typed_func::<(), ()>(&mut store, "_start").map_err(|e| e.to_string())?;
        let mut raw = Raw::default();
        if let Err(e) = start.call(&mut store, ())
            && e.downcast_ref::<I32Exit>().is_none()
        {
            match e.downcast_ref::<Trap>() {
                Some(Trap::Interrupt) => raw.timed_out = true,
                Some(Trap::StackOverflow) => {
                    raw.crash = Some("RecursionError: stack overflow (recursion too deep)".into())
                }
                Some(trap) => raw.crash = Some(format!("Python crashed: {trap}")),
                None => raw.crash = Some(format!("Python crashed: {e}")),
            }
        }
        drop(store);
        raw.stdout = String::from_utf8_lossy(&stdout.contents()).into_owned();
        raw.stderr = String::from_utf8_lossy(&stderr.contents()).into_owned();
        raw.output_limited = raw.stdout.len() >= OUTPUT_CAP;
        Ok(raw)
    }
}

/// Fallback when the WebAssembly build isn't bundled: the user's own Python, not sandboxed.
pub fn run_system(python: &Tool, code: &str, spec: &RunSpec, limits: Limits) -> RunResult {
    let dir = match tempfile::Builder::new().prefix("codegym-py").tempdir() {
        Ok(d) => d,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't create a temp folder: {e}")),
    };
    let nonce = nonce();
    let input = payload(spec, &nonce, code.lines().count(), Some(code));
    let mut cmd = python.command();
    cmd.args(["-E", "-S", "-B", "-X", "utf8", "-c", HARNESS]).current_dir(dir.path());
    let out = match process::run(cmd, input.as_bytes(), limits.timeout) {
        Ok(o) => o,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't start Python: {e}")),
    };
    let raw = Raw {
        stdout: out.stdout,
        stderr: out.stderr,
        timed_out: out.timed_out,
        output_limited: out.output_limited,
        crash: None,
    };
    outcome::assemble(spec, &raw, &nonce, limits.timeout, &|s: &str| s.trim().to_string())
}
