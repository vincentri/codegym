//! Starter code shown to solvers. Must match `apps/desktop/src/lib/starter-code.ts`.

use codegym_core::{Language, ParamType, Signature};

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
    }
}
