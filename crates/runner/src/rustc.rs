//! Rust: the system `rustc`. The solver writes LeetCode-style `impl Solution` with snake_case
//! names; the harness `include!`s their file so compiler errors point at their lines.

use std::fmt::Write as _;
use std::process::Command;

use codegym_core::{ParamType, RunResult};

use crate::native::{self, snake_case, strip_dir};
use crate::process::Tool;
use crate::{Limits, RunSpec};

const HARNESS: &str = include_str!("harness/main.rs");

pub fn rust_type(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "i32",
        ParamType::Float => "f64",
        ParamType::Bool => "bool",
        ParamType::String => "String",
        ParamType::IntArray => "Vec<i32>",
        ParamType::FloatArray => "Vec<f64>",
        ParamType::StringArray => "Vec<String>",
        ParamType::BoolArray => "Vec<bool>",
        ParamType::IntMatrix => "Vec<Vec<i32>>",
        ParamType::StringMatrix => "Vec<Vec<String>>",
        ParamType::CharMatrix => "Vec<Vec<char>>",
        ParamType::ListNode => "Option<Box<ListNode>>",
        ParamType::ListNodeArray => "Vec<Option<Box<ListNode>>>",
        ParamType::TreeNode => "Option<Rc<RefCell<TreeNode>>>",
        ParamType::Void => "()",
    }
}

fn call_function(spec: &RunSpec) -> String {
    let sig = &spec.signature;
    let mut s = String::from("fn cg_call(a: &[Json]) -> Result<(String, f64), String> {\n");
    let _ =
        writeln!(s, "    if a.len() != {} {{ return Err(\"wrong number of arguments\".into()); }}", sig.params.len());
    for (i, p) in sig.params.iter().enumerate() {
        let mutable = if spec.in_place_arg == Some(i) { "mut " } else { "" };
        let _ = writeln!(s, "    let {mutable}a{i}: {} = cg_arg(&a[{i}], {:?})?;", rust_type(p.ty), p.name);
    }
    let args = (0..sig.params.len())
        .map(|i| if spec.in_place_arg == Some(i) { format!("&mut a{i}") } else { format!("a{i}") })
        .collect::<Vec<_>>()
        .join(", ");
    let call = format!("Solution::{}({args})", snake_case(&sig.function_name));
    s.push_str("    let cg_t0 = std::time::Instant::now();\n");
    match (sig.returns, spec.in_place_arg) {
        (ParamType::Void, Some(k)) => {
            let _ = writeln!(s, "    {call};\n    let ms = cg_ms(cg_t0);\n    Ok((cg_json(&a{k})?, ms))");
        }
        (ParamType::Void, None) => {
            let _ = writeln!(s, "    {call};\n    let ms = cg_ms(cg_t0);\n    Ok((\"null\".to_string(), ms))");
        }
        _ => {
            let _ = writeln!(s, "    let r = {call};\n    let ms = cg_ms(cg_t0);\n    Ok((cg_json(&r)?, ms))");
        }
    }
    s.push_str("}\n");
    s
}

pub fn run(rustc: &Tool, code: &str, spec: &RunSpec, limits: Limits) -> RunResult {
    let main = HARNESS.replace("// __CGCALL__", &call_function(spec));
    let compiler = rustc.path.clone();
    let exe = if cfg!(windows) { "solution.exe" } else { "solution" };
    let clean = |s: &str, dir: &std::path::Path| strip_dir(s, dir).replace("./solution.rs", "solution.rs");
    native::compile_and_run(
        spec,
        limits,
        "codegym-rust",
        &[("solution.rs", code), ("main.rs", &main)],
        |_| {
            let mut c = Command::new(&compiler);
            c.args([
                "--edition",
                "2021",
                "-C",
                "opt-level=2",
                "-C",
                "overflow-checks=on",
                "-C",
                "debuginfo=0",
                "--cap-lints",
                "allow",
                "-o",
                exe,
                "main.rs",
            ]);
            c
        },
        |dir| Command::new(dir.join(exe)),
        &clean,
        code.lines().count(),
    )
}
