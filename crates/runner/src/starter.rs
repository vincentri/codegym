//! Starter code shown to solvers. Must match `apps/desktop/src/lib/starter-code.ts`.

use codegym_core::{Language, ParamType, Signature};

use crate::cpp::{cpp_param, cpp_type};
use crate::java::java_type;
use crate::native::snake_case;
use crate::rustc::rust_type;

fn type_name(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "int",
        ParamType::Float => "float",
        ParamType::Bool => "bool",
        ParamType::String => "string",
        ParamType::IntArray => "int[]",
        ParamType::FloatArray => "float[]",
        ParamType::StringArray => "string[]",
        ParamType::BoolArray => "bool[]",
        ParamType::IntMatrix => "int[][]",
        ParamType::StringMatrix => "string[][]",
        ParamType::CharMatrix => "char[][]",
        ParamType::ListNode => "ListNode",
        ParamType::ListNodeArray => "ListNode[]",
        ParamType::TreeNode => "TreeNode",
        ParamType::Void => "void",
    }
}

fn py_type(t: ParamType) -> &'static str {
    match t {
        ParamType::Int => "int",
        ParamType::Float => "float",
        ParamType::Bool => "bool",
        ParamType::String => "str",
        ParamType::IntArray => "List[int]",
        ParamType::FloatArray => "List[float]",
        ParamType::StringArray => "List[str]",
        ParamType::BoolArray => "List[bool]",
        ParamType::IntMatrix => "List[List[int]]",
        ParamType::StringMatrix | ParamType::CharMatrix => "List[List[str]]",
        ParamType::ListNode => "Optional[ListNode]",
        ParamType::ListNodeArray => "List[Optional[ListNode]]",
        ParamType::TreeNode => "Optional[TreeNode]",
        ParamType::Void => "None",
    }
}

fn ts_type(t: ParamType) -> &'static str {
    match t {
        ParamType::Int | ParamType::Float => "number",
        ParamType::Bool => "boolean",
        ParamType::String => "string",
        ParamType::IntArray | ParamType::FloatArray => "number[]",
        ParamType::StringArray => "string[]",
        ParamType::BoolArray => "boolean[]",
        ParamType::IntMatrix => "number[][]",
        ParamType::StringMatrix | ParamType::CharMatrix => "string[][]",
        ParamType::ListNode => "ListNode | null",
        ParamType::ListNodeArray => "Array<ListNode | null>",
        ParamType::TreeNode => "TreeNode | null",
        ParamType::Void => "void",
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

/// Starter code for a problem. `in_place_arg` marks the argument modified in place (Rust takes
/// it as `&mut`).
pub fn starter_code_for(sig: &Signature, in_place_arg: Option<usize>, language: Language) -> String {
    let name = &sig.function_name;
    let list = |f: &dyn Fn(usize, &codegym_core::Param) -> String| {
        sig.params.iter().enumerate().map(|(i, p)| f(i, p)).collect::<Vec<_>>().join(", ")
    };
    match language {
        Language::Typescript => {
            let args = list(&|_, p| format!("{}: {}", p.name, ts_type(p.ty)));
            format!("function {name}({args}): {} {{\n  \n}}\n", ts_type(sig.returns))
        }
        Language::Java => {
            let args = list(&|_, p| format!("{} {}", java_type(p.ty), p.name));
            format!(
                "class Solution {{\n    public {} {name}({args}) {{\n        \n    }}\n}}\n",
                java_type(sig.returns)
            )
        }
        Language::Cpp => {
            let args = list(&|_, p| format!("{} {}", cpp_param(p.ty), p.name));
            format!(
                "class Solution {{\npublic:\n    {} {name}({args}) {{\n        \n    }}\n}};\n",
                cpp_type(sig.returns)
            )
        }
        Language::Rust => {
            let args = list(&|i, p| {
                let ty = rust_type(p.ty);
                let ty = if in_place_arg == Some(i) { format!("&mut {ty}") } else { ty.to_string() };
                format!("{}: {ty}", snake_case(&p.name))
            });
            let ret =
                if sig.returns == ParamType::Void { String::new() } else { format!(" -> {}", rust_type(sig.returns)) };
            format!("impl Solution {{\n    pub fn {}({args}){ret} {{\n        \n    }}\n}}\n", snake_case(name))
        }
        _ => starter_code(sig, language),
    }
}

pub fn starter_code(sig: &Signature, language: Language) -> String {
    let name = &sig.function_name;
    match language {
        Language::Python => {
            let args = std::iter::once("self".to_string())
                .chain(sig.params.iter().map(|p| format!("{}: {}", p.name, py_type(p.ty))))
                .collect::<Vec<_>>()
                .join(", ");
            format!("class Solution:\n    def {name}({args}) -> {}:\n        pass\n", py_type(sig.returns))
        }
        Language::Javascript => {
            let doc = sig
                .params
                .iter()
                .map(|p| format!(" * @param {{{}}} {}", type_name(p.ty), p.name))
                .collect::<Vec<_>>()
                .join("\n");
            let names = sig.params.iter().map(|p| p.name.as_str()).collect::<Vec<_>>().join(", ");
            format!("/**\n{doc}\n * @return {{{}}}\n */\nfunction {name}({names}) {{\n  \n}}\n", type_name(sig.returns))
        }
        Language::Go => {
            let args =
                sig.params.iter().map(|p| format!("{} {}", p.name, go_type(p.ty))).collect::<Vec<_>>().join(", ");
            let ret = go_type(sig.returns);
            let ret = if ret.is_empty() { String::new() } else { format!(" {ret}") };
            format!("func {name}({args}){ret} {{\n    \n}}\n")
        }
        other => starter_code_for(sig, None, other),
    }
}
