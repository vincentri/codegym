//! Shared steps for languages that compile to a program first (Java, C++, Rust): write the
//! files, compile with the system toolchain, run with the test payload, and report.

use std::fmt::Write as _;
use std::path::Path;
use std::process::{Command, ExitStatus};
use std::time::Duration;

use codegym_core::RunResult;

use crate::outcome::{self, Raw};
use crate::process;
use crate::{Limits, RunSpec, nonce, payload};

pub const BUILD_TIMEOUT: Duration = Duration::from_secs(120);

/// Maps `{key}12` (e.g. `Solution.java:12`) back to the line the solver sees, when `offset`
/// lines were added in front of their code.
pub fn shift_lines(text: &str, key: &str, offset: usize) -> String {
    if offset == 0 {
        return text.to_string();
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(pos) = rest.find(key) {
        out.push_str(&rest[..pos + key.len()]);
        rest = &rest[pos + key.len()..];
        let digits = rest.chars().take_while(char::is_ascii_digit).count();
        if let Ok(n) = rest[..digits].parse::<usize>() {
            let _ = write!(out, "{}", n.saturating_sub(offset).max(1));
            rest = &rest[digits..];
        }
    }
    out.push_str(rest);
    out
}

/// Why a program died, when the operating system killed it.
pub fn crash_reason(status: Option<ExitStatus>) -> Option<String> {
    let status = status?;
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if let Some(sig) = status.signal() {
            let what = match sig {
                11 => "segmentation fault: an out-of-bounds index or a null/dangling pointer".to_string(),
                10 => "bus error: an invalid memory access".to_string(),
                6 => "aborted (often a failed assertion or uncaught exception)".to_string(),
                8 => "arithmetic error, such as integer division by zero".to_string(),
                other => format!("signal {other}"),
            };
            return Some(format!("Your program crashed: {what}."));
        }
    }
    #[cfg(windows)]
    {
        match status.code().map(|c| c as u32) {
            Some(0xC000_0005) => {
                return Some("Your program crashed: access violation (out-of-bounds or null pointer).".into());
            }
            Some(0xC000_00FD) => return Some("Your program crashed: stack overflow (recursion too deep).".into()),
            Some(0xC000_0094) => return Some("Your program crashed: integer division by zero.".into()),
            _ => {}
        }
    }
    None
}

/// Writes `files` into a temp folder, runs `compile` there, then runs the program on the tests.
/// `make_compile` and `make_run` get the folder; `clean` tidies compiler and error output.
#[allow(clippy::too_many_arguments)] // each is a distinct per-language step
pub fn compile_and_run(
    spec: &RunSpec,
    limits: Limits,
    prefix: &str,
    files: &[(&str, &str)],
    make_compile: impl FnOnce(&Path) -> Command,
    make_run: impl FnOnce(&Path) -> Command,
    clean: &dyn Fn(&str, &Path) -> String,
    user_lines: usize,
) -> RunResult {
    let dir = match tempfile::Builder::new().prefix(prefix).tempdir() {
        Ok(d) => d,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't create a temp folder: {e}")),
    };
    for (name, body) in files {
        if let Err(e) = std::fs::write(dir.path().join(name), body) {
            return outcome::internal_error(spec, format!("Couldn't write {name}: {e}"));
        }
    }
    let mut compile = make_compile(dir.path());
    compile.current_dir(dir.path());
    let built = match process::run(compile, &[], BUILD_TIMEOUT) {
        Ok(o) => o,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't start the compiler: {e}")),
    };
    if !built.success() {
        let text = if built.timed_out {
            "The compiler took too long.".to_string()
        } else {
            clean(&format!("{}{}", built.stdout, built.stderr), dir.path())
        };
        return outcome::compile_error(spec, text.trim().to_string());
    }

    let nonce = nonce();
    let mut cmd = make_run(dir.path());
    cmd.current_dir(dir.path());
    let input = payload(spec, &nonce, user_lines, None);
    let out = match process::run(cmd, input.as_bytes(), limits.timeout) {
        Ok(o) => o,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't start your program: {e}")),
    };
    let crash = if out.timed_out || out.output_limited { None } else { crash_reason(out.status) };
    let raw = Raw {
        stdout: out.stdout,
        stderr: clean(&out.stderr, dir.path()),
        timed_out: out.timed_out,
        output_limited: out.output_limited,
        crash,
    };
    let path = dir.path().to_path_buf();
    outcome::assemble(spec, &raw, &nonce, limits.timeout, &|s| clean(s, &path))
}

/// Removes the temp folder from paths in compiler and error output.
pub fn strip_dir(text: &str, dir: &Path) -> String {
    let prefix = format!("{}{}", dir.display(), std::path::MAIN_SEPARATOR);
    text.replace(&prefix, "").replace(&dir.display().to_string(), ".")
}

/// `twoSum` → `two_sum`, `lengthOfLIS` → `length_of_lis`, `isValidBST` → `is_valid_bst`.
pub fn snake_case(name: &str) -> String {
    let chars: Vec<char> = name.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if c.is_ascii_uppercase() {
            let prev = i.checked_sub(1).map(|j| chars[j]);
            let next = chars.get(i + 1);
            let boundary = prev.is_some_and(|p| p.is_ascii_lowercase() || p.is_ascii_digit())
                || (prev.is_some_and(|p| p.is_ascii_uppercase()) && next.is_some_and(|n| n.is_ascii_lowercase()));
            if boundary {
                out.push('_');
            }
            out.push(c.to_ascii_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snake_cases_names() {
        assert_eq!(snake_case("twoSum"), "two_sum");
        assert_eq!(snake_case("lengthOfLIS"), "length_of_lis");
        assert_eq!(snake_case("isValidBST"), "is_valid_bst");
        assert_eq!(snake_case("numIslands"), "num_islands");
        assert_eq!(snake_case("nums"), "nums");
    }
}
