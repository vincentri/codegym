//! Java: the system JDK. The solver writes LeetCode-style `class Solution`; the harness decodes
//! each argument into the declared Java type and calls the method.

use std::fmt::Write as _;
use std::process::Command;

use codegym_core::{ParamType, RunResult};

use crate::native::{self, shift_lines, strip_dir};
use crate::process::Tool;
use crate::{Limits, RunSpec};

const HARNESS: &str = include_str!("harness/Main.java");
/// Imports LeetCode provides implicitly, added in front of the solver's code on one line.
const IMPORTS: &str = "import java.util.*; import java.util.function.*; import java.util.stream.*;";

pub fn java_type(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "int",
        ParamType::Float => "double",
        ParamType::Bool => "boolean",
        ParamType::String => "String",
        ParamType::IntArray => "int[]",
        ParamType::FloatArray => "double[]",
        ParamType::StringArray => "String[]",
        ParamType::BoolArray => "boolean[]",
        ParamType::IntMatrix => "int[][]",
        ParamType::StringMatrix => "String[][]",
        ParamType::CharMatrix => "char[][]",
        ParamType::ListNode => "ListNode",
        ParamType::ListNodeArray => "ListNode[]",
        ParamType::TreeNode => "TreeNode",
        ParamType::Void => "void",
    }
}

fn decoder(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "cgInt",
        ParamType::Float => "cgDouble",
        ParamType::Bool => "cgBool",
        ParamType::String => "cgString",
        ParamType::IntArray => "cgIntArr",
        ParamType::FloatArray => "cgDoubleArr",
        ParamType::StringArray => "cgStringArr",
        ParamType::BoolArray => "cgBoolArr",
        ParamType::IntMatrix => "cgIntMatrix",
        ParamType::StringMatrix => "cgStringMatrix",
        ParamType::CharMatrix => "cgCharMatrix",
        ParamType::ListNode => "cgListNode",
        ParamType::ListNodeArray => "cgListNodes",
        ParamType::TreeNode => "cgTreeNode",
        ParamType::Void => "",
    }
}

fn call_function(spec: &RunSpec) -> String {
    let sig = &spec.signature;
    let mut s = String::from("static Object cgCall(List<?> a, long[] ns) throws Throwable {\n");
    let _ = writeln!(
        s,
        "        if (a.size() != {}) throw new IllegalArgumentException(\"wrong number of arguments\");",
        sig.params.len()
    );
    for (i, p) in sig.params.iter().enumerate() {
        let _ = writeln!(s, "        {} a{i} = {}(a.get({i}));", java_type(p.ty), decoder(p.ty));
    }
    let args = (0..sig.params.len()).map(|i| format!("a{i}")).collect::<Vec<_>>().join(", ");
    s.push_str("        Solution cgS = new Solution();\n        long cgT0 = System.nanoTime();\n");
    let call = format!("cgS.{}({args})", sig.function_name);
    match (sig.returns, spec.in_place_arg) {
        (ParamType::Void, Some(k)) => {
            let _ = writeln!(s, "        {call};\n        ns[0] = System.nanoTime() - cgT0;\n        Object r = a{k};");
        }
        (ParamType::Void, None) => {
            let _ = writeln!(s, "        {call};\n        ns[0] = System.nanoTime() - cgT0;\n        Object r = null;");
        }
        _ => {
            let _ = writeln!(s, "        Object r = {call};\n        ns[0] = System.nanoTime() - cgT0;");
        }
    }
    // An empty linked list or tree is `null` in Java but `[]` in the tests.
    let out_type = spec.in_place_arg.and_then(|k| sig.params.get(k)).map(|p| p.ty).unwrap_or(sig.returns);
    if matches!(out_type, ParamType::ListNode | ParamType::TreeNode) {
        s.push_str("        if (r == null) r = new ArrayList<Object>();\n");
    }
    s.push_str("        return r;\n    }\n");
    s
}

pub fn run(javac: &Tool, code: &str, spec: &RunSpec, limits: Limits) -> RunResult {
    let solution = format!("{IMPORTS}\n{code}");
    let main = HARNESS.replace("// __CGCALL__", &call_function(spec));
    let java = javac.path.with_file_name(if cfg!(windows) { "java.exe" } else { "java" });
    let javac_path = javac.path.clone();
    let memory = limits.memory_mb;
    let clean = |s: &str, dir: &std::path::Path| {
        let text = strip_dir(s, dir)
            .lines()
            .filter(|l| !l.starts_with("Picked up ") && !l.starts_with("Note: "))
            .collect::<Vec<_>>()
            .join("\n");
        let text = shift_lines(&text, "Solution.java:", 1);
        if text.contains("Main.java:") && text.contains("error:") {
            format!("{text}\n\nKeep the class name and method signature from the starter code.")
        } else {
            text
        }
    };
    let without_java_env = |cmd: &mut Command| {
        for var in ["JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS"] {
            cmd.env_remove(var);
        }
    };
    native::compile_and_run(
        spec,
        limits,
        "codegym-java",
        &[("Solution.java", &solution), ("Main.java", &main)],
        |_| {
            let mut c = Command::new(&javac_path);
            without_java_env(&mut c);
            c.args(["-encoding", "UTF-8", "-nowarn", "-d", "out", "Solution.java", "Main.java"]);
            c
        },
        |_| {
            let mut c = Command::new(&java);
            without_java_env(&mut c);
            c.arg(format!("-Xmx{memory}m")).args(["-Xss256m", "-XX:+UseSerialGC", "-cp", "out", "Main"]);
            c
        },
        &clean,
        code.lines().count(),
    )
}
