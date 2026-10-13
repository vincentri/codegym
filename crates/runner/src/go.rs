//! Go: the system toolchain. The harness is generated per signature, so arguments are decoded
//! straight into typed Go values.

use std::fmt::Write as _;
use std::time::Duration;

use codegym_core::{ParamType, RunResult};

use crate::native::shift_lines;
use crate::outcome::{self, Raw};
use crate::process::{self, Tool};
use crate::{Limits, RunSpec, nonce, payload};

const HARNESS: &str = include_str!("harness/harness.go");
const BUILD_TIMEOUT: Duration = Duration::from_secs(120);

/// Packages solvers commonly use, imported for them when their code has no imports. The blank
/// uses keep Go from rejecting the ones they don't touch.
const AUTO_HEADER: &str = concat!(
    r#"package main; import ("container/heap"; "container/list"; "fmt"; "math"; "math/bits"; "#,
    r#""math/rand"; "slices"; "sort"; "strconv"; "strings"; "unicode"); "#,
    r#"var _, _, _, _, _, _, _, _, _, _, _ = heap.Init, list.New, fmt.Sprint, math.Abs, bits.OnesCount, "#,
    r#"rand.Intn, slices.Index[[]int], sort.Ints, strconv.Itoa, strings.Split, unicode.IsLetter"#
);

fn has_line_starting(code: &str, word: &str) -> bool {
    code.lines().any(|l| l.trim_start().starts_with(word))
}

/// The solver's file, plus how many lines were added in front of their code.
fn solution_file(code: &str) -> (String, usize) {
    if has_line_starting(code, "package ") {
        (code.to_string(), 0)
    } else if has_line_starting(code, "import ") || has_line_starting(code, "import(") {
        (format!("package main\n{code}"), 1)
    } else {
        (format!("{AUTO_HEADER}\n{code}"), 1)
    }
}

fn go_type(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "int",
        ParamType::Float => "float64",
        ParamType::Bool => "bool",
        ParamType::String => "string",
        ParamType::IntArray => "[]int",
        ParamType::FloatArray => "[]float64",
        ParamType::StringArray => "[]string",
        ParamType::BoolArray => "[]bool",
        ParamType::IntMatrix => "[][]int",
        ParamType::StringMatrix => "[][]string",
        ParamType::CharMatrix => "[][]byte",
        ParamType::ListNode => "*ListNode",
        ParamType::ListNodeArray => "[]*ListNode",
        ParamType::TreeNode => "*TreeNode",
        ParamType::Void => "",
    }
}

/// How a JSON argument is decoded: the type to unmarshal into and the conversion to apply.
fn decoder(t: ParamType) -> (&'static str, &'static str) {
    match t {
        ParamType::CharMatrix => ("[][]string", "cgToBytes"),
        ParamType::ListNode => ("[]int", "cgToList"),
        ParamType::ListNodeArray => ("[][]int", "cgToLists"),
        ParamType::TreeNode => ("[]*int", "cgToTree"),
        other => (go_type(other), ""),
    }
}

/// Converts a Go value of type `t` into something that marshals to the expected JSON.
fn encoder(t: ParamType) -> &'static str {
    match t {
        ParamType::IntArray | ParamType::FloatArray | ParamType::StringArray | ParamType::BoolArray => "cgSlice",
        ParamType::IntMatrix | ParamType::StringMatrix => "cgMatrix",
        ParamType::CharMatrix => "cgFromBytes",
        ParamType::ListNode => "cgFromList",
        ParamType::ListNodeArray => "cgFromLists",
        ParamType::TreeNode => "cgFromTree",
        _ => "",
    }
}

/// The generated `cgCall`, which decodes one test's arguments and calls the solver's function.
fn call_function(spec: &RunSpec) -> String {
    let sig = &spec.signature;
    let mut s = String::from("func cgCall(args []json.RawMessage) (value any, ms float64) {\n");
    let _ = writeln!(
        s,
        "\tif len(args) != {} {{\n\t\tpanic(cgInputError(\"wrong number of arguments\"))\n\t}}",
        sig.params.len()
    );
    for (i, p) in sig.params.iter().enumerate() {
        let (raw, convert) = decoder(p.ty);
        if convert.is_empty() {
            let _ = writeln!(s, "\tvar a{i} {raw}\n\tcgDecode(args[{i}], &a{i}, {:?})", p.name);
        } else {
            let _ =
                writeln!(s, "\tvar r{i} {raw}\n\tcgDecode(args[{i}], &r{i}, {:?})\n\ta{i} := {convert}(r{i})", p.name);
        }
    }
    let args = (0..sig.params.len()).map(|i| format!("a{i}")).collect::<Vec<_>>().join(", ");
    let call = format!("{}({args})", sig.function_name);
    s.push_str("\tstart := time.Now()\n");
    let wrap = |enc: &str, v: &str| if enc.is_empty() { v.to_string() } else { format!("{enc}({v})") };
    match (sig.returns, spec.in_place_arg) {
        (ParamType::Void, Some(k)) => {
            let _ = writeln!(
                s,
                "\t{call}\n\tms = cgSince(start)\n\tvalue = {}",
                wrap(encoder(sig.params[k].ty), &format!("a{k}"))
            );
        }
        (ParamType::Void, None) => {
            let _ = writeln!(s, "\t{call}\n\tms = cgSince(start)\n\tvalue = nil");
        }
        (ret, _) => {
            let _ = writeln!(s, "\tres := {call}\n\tms = cgSince(start)\n\tvalue = {}", wrap(encoder(ret), "res"));
        }
    }
    s.push_str("\treturn\n}\n");
    s
}

pub fn run(go: &Tool, code: &str, spec: &RunSpec, limits: Limits) -> RunResult {
    if code.lines().any(|l| l.trim_start().starts_with("func main(")) {
        return outcome::compile_error(spec, "Remove `func main()`: CodeGym calls your function for you.".into());
    }
    let dir = match tempfile::Builder::new().prefix("codegym-go").tempdir() {
        Ok(d) => d,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't create a temp folder: {e}")),
    };
    let (solution, offset) = solution_file(code);
    let harness = format!("{HARNESS}\n{}", call_function(spec));
    let files =
        [("go.mod", "module solution\n\ngo 1.21\n"), ("solution.go", solution.as_str()), ("main.go", harness.as_str())];
    for (name, body) in files {
        if let Err(e) = std::fs::write(dir.path().join(name), body) {
            return outcome::internal_error(spec, format!("Couldn't write {name}: {e}"));
        }
    }
    let prefix = format!("{}{}", dir.path().display(), std::path::MAIN_SEPARATOR);
    let clean =
        |s: &str| shift_lines(&s.replace(&prefix, "").replace("./solution.go", "solution.go"), "solution.go:", offset);

    let exe = dir.path().join(if cfg!(windows) { "solution.exe" } else { "solution" });
    let mut build = go.command();
    build
        .args(["build", "-o"])
        .arg(&exe)
        .arg(".")
        .current_dir(dir.path())
        .env("GOTOOLCHAIN", "local")
        .env("GOFLAGS", "")
        .env("GO111MODULE", "on")
        .env("GOWORK", "off")
        .env("CGO_ENABLED", "0");
    let built = match process::run(build, &[], BUILD_TIMEOUT) {
        Ok(o) => o,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't start the Go compiler: {e}")),
    };
    if !built.success() {
        let text = format!("{}{}", built.stdout, built.stderr);
        let text = text.lines().filter(|l| !l.starts_with("# ")).collect::<Vec<_>>().join("\n");
        let text = if built.timed_out { "The Go compiler took too long.".into() } else { clean(text.trim()) };
        return outcome::compile_error(spec, text);
    }

    let nonce = nonce();
    let mut cmd = std::process::Command::new(&exe);
    cmd.current_dir(dir.path()).env("GOMEMLIMIT", format!("{}MiB", limits.memory_mb));
    let input = payload(spec, &nonce, code.lines().count(), None);
    let out = match process::run(cmd, input.as_bytes(), limits.timeout) {
        Ok(o) => o,
        Err(e) => return outcome::internal_error(spec, format!("Couldn't start your program: {e}")),
    };
    let stderr = trim_go_crash(&out.stderr);
    let raw =
        Raw { stdout: out.stdout, stderr, timed_out: out.timed_out, output_limited: out.output_limited, crash: None };
    outcome::assemble(spec, &raw, &nonce, limits.timeout, &clean)
}

/// Keeps the first lines of a Go crash (the reason) and drops goroutine dumps.
fn trim_go_crash(stderr: &str) -> String {
    let mut out = Vec::new();
    for line in stderr.lines() {
        if line.starts_with("goroutine ") || line.starts_with("runtime stack:") {
            break;
        }
        out.push(line);
    }
    out.join("\n").trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shifts_line_numbers() {
        let shift = |s: &str| shift_lines(s, "solution.go:", 1);
        assert_eq!(shift("solution.go:3:5: undefined: x"), "solution.go:2:5: undefined: x");
        assert_eq!(shift("at solution.go:10 +0x1"), "at solution.go:9 +0x1");
        assert_eq!(shift("no match"), "no match");
    }

    #[test]
    fn adds_package_and_imports_only_when_missing() {
        assert_eq!(solution_file("package main\nfunc f() {}").1, 0);
        assert!(solution_file("import \"sort\"\nfunc f() {}").0.starts_with("package main\nimport"));
        let (auto, offset) = solution_file("func f() {}");
        assert_eq!(offset, 1);
        assert_eq!(auto.lines().count(), 2);
    }
}
