//! C++: the system compiler (g++ or clang++), C++17. The solver writes LeetCode-style
//! `class Solution`; a prelude provides the standard library and the list/tree types.

use std::fmt::Write as _;
use std::process::Command;

use codegym_core::{ParamType, RunResult};

use crate::native::{self, strip_dir};
use crate::process::Tool;
use crate::{Limits, RunSpec};

const PRELUDE: &str = include_str!("harness/prelude.hpp");
const HARNESS: &str = include_str!("harness/main.cpp");

pub fn cpp_type(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "int",
        ParamType::Float => "double",
        ParamType::Bool => "bool",
        ParamType::String => "string",
        ParamType::IntArray => "vector<int>",
        ParamType::FloatArray => "vector<double>",
        ParamType::StringArray => "vector<string>",
        ParamType::BoolArray => "vector<bool>",
        ParamType::IntMatrix => "vector<vector<int>>",
        ParamType::StringMatrix => "vector<vector<string>>",
        ParamType::CharMatrix => "vector<vector<char>>",
        ParamType::ListNode => "ListNode*",
        ParamType::ListNodeArray => "vector<ListNode*>",
        ParamType::TreeNode => "TreeNode*",
        ParamType::Void => "void",
    }
}

/// Parameter type as written in the starter code: containers by reference, like LeetCode.
pub fn cpp_param(t: ParamType) -> String {
    let base = cpp_type(t);
    if base.starts_with("vector") || base == "string" { format!("{base}&") } else { base.to_string() }
}

fn call_function(spec: &RunSpec) -> String {
    let sig = &spec.signature;
    let mut s = String::from("std::string cg_call(const std::vector<cg::Json> &a, double &ms) {\n");
    let _ = writeln!(
        s,
        "    if (a.size() != {}) throw std::runtime_error(\"wrong number of arguments\");",
        sig.params.len()
    );
    for (i, p) in sig.params.iter().enumerate() {
        let init = if matches!(p.ty, ParamType::ListNode | ParamType::TreeNode) { " = nullptr" } else { "{}" };
        let _ = writeln!(s, "    {} a{i}{init};\n    cg::from(a[{i}], a{i});", cpp_type(p.ty));
    }
    let args = (0..sig.params.len()).map(|i| format!("a{i}")).collect::<Vec<_>>().join(", ");
    s.push_str("    Solution cg_s;\n    auto cg_t0 = std::chrono::steady_clock::now();\n");
    let call = format!("cg_s.{}({args})", sig.function_name);
    match (sig.returns, spec.in_place_arg) {
        (ParamType::Void, Some(k)) => {
            let _ = writeln!(s, "    {call};\n    ms = cg::since(cg_t0);\n    return cg::json(a{k});");
        }
        (ParamType::Void, None) => {
            let _ = writeln!(s, "    {call};\n    ms = cg::since(cg_t0);\n    return \"null\";");
        }
        _ => {
            let _ = writeln!(s, "    auto cg_r = {call};\n    ms = cg::since(cg_t0);\n    return cg::json(cg_r);");
        }
    }
    s.push_str("}\n");
    s
}

pub fn run(cxx: &Tool, code: &str, spec: &RunSpec, limits: Limits) -> RunResult {
    let main = HARNESS.replace("// __CGCALL__", &call_function(spec));
    let compiler = cxx.path.clone();
    let exe = if cfg!(windows) { "solution.exe" } else { "solution" };
    let clean = |s: &str, dir: &std::path::Path| {
        strip_dir(s, dir)
            .replace("./solution.cpp", "solution.cpp")
            .lines()
            .filter(|l| !l.starts_with("In file included from") && !l.trim_start().starts_with("from "))
            .collect::<Vec<_>>()
            .join("\n")
    };
    native::compile_and_run(
        spec,
        limits,
        "codegym-cpp",
        &[("prelude.hpp", PRELUDE), ("solution.cpp", code), ("main.cpp", &main)],
        |_| {
            let mut c = Command::new(&compiler);
            // A missing `return` is only a warning in C++; make it an error like other languages.
            c.args(["-std=c++17", "-O2", "-Werror=return-type", "-o", exe, "main.cpp"]);
            c
        },
        |dir| Command::new(dir.join(exe)),
        &clean,
        code.lines().count(),
    )
}
