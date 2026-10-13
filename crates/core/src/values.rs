//! Checks that questions and their test values are well formed. The store, the built-in bank
//! test and the AI import all use these, and the editor's Zod schema enforces the same rules.

use serde_json::Value;

use crate::types::{ParamType, QuestionInput};

/// True when `v` has the JSON shape `t` promises, so every language's harness can decode it.
pub fn fits(t: ParamType, v: &Value) -> bool {
    let all = |v: &Value, f: &dyn Fn(&Value) -> bool| v.as_array().is_some_and(|a| a.iter().all(f));
    let int = |v: &Value| v.is_i64();
    let num = |v: &Value| v.is_number();
    let string = |v: &Value| v.is_string();
    let ch = |v: &Value| v.as_str().is_some_and(|s| s.chars().count() == 1);
    match t {
        ParamType::Int => int(v),
        ParamType::Float => num(v),
        ParamType::Bool => v.is_boolean(),
        ParamType::String => string(v),
        ParamType::IntArray | ParamType::ListNode => all(v, &int),
        ParamType::FloatArray => all(v, &num),
        ParamType::StringArray => all(v, &string),
        ParamType::BoolArray => all(v, &Value::is_boolean),
        ParamType::IntMatrix | ParamType::ListNodeArray => all(v, &|r| all(r, &int)),
        ParamType::StringMatrix => all(v, &|r| all(r, &string)),
        ParamType::CharMatrix => all(v, &|r| all(r, &ch)),
        ParamType::TreeNode => all(v, &|x| x.is_null() || x.is_i64()) && v.get(0).is_none_or(|x| !x.is_null()),
        ParamType::Void => v.is_null(),
    }
}

/// True for names every harness can splice into code: `[A-Za-z_][A-Za-z0-9_]*`.
pub fn is_identifier(s: &str) -> bool {
    let mut chars = s.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// The type of each test's expected answer: the return type, or the in-place argument's type.
pub fn answer_type(q: &QuestionInput) -> Option<ParamType> {
    match q.in_place_arg {
        Some(k) => q.signature.params.get(k).map(|p| p.ty),
        None => Some(q.signature.returns),
    }
}

/// Checks a question before it is saved. Returns a message the UI can show.
pub fn validate_question(q: &QuestionInput) -> Result<(), String> {
    let sig = &q.signature;
    if q.title.trim().chars().count() < 3 {
        return Err("Title is too short".into());
    }
    if !is_identifier(&sig.function_name) {
        return Err(format!("`{}` isn't a valid function name", sig.function_name));
    }
    if sig.params.is_empty() {
        return Err("Add at least one parameter".into());
    }
    if let Some(p) = sig.params.iter().find(|p| !is_identifier(&p.name) || p.ty == ParamType::Void) {
        return Err(format!("Parameter `{}` needs a valid name and a non-void type", p.name));
    }
    match (q.in_place_arg, sig.returns) {
        (Some(i), _) if i >= sig.params.len() => {
            return Err("The in-place argument must be one of the parameters".into());
        }
        (Some(_), r) if r != ParamType::Void => {
            return Err("A function that modifies an argument in place must return void".into());
        }
        (None, ParamType::Void) => return Err("A void function must modify one of its arguments in place".into()),
        _ => {}
    }
    if q.tests.len() < 3 {
        return Err("Add at least 3 test cases".into());
    }
    if q.tests.iter().all(|t| t.hidden) {
        return Err("Keep at least one test visible as an example".into());
    }
    let answer = answer_type(q);
    for (i, t) in q.tests.iter().enumerate() {
        if t.input.len() != sig.params.len() {
            return Err(format!("Test {} needs one value per parameter", i + 1));
        }
        if let Some(p) = sig.params.iter().zip(&t.input).find(|(p, v)| !fits(p.ty, v)).map(|(p, _)| p) {
            return Err(format!("Test {}: `{}` isn't a valid {}", i + 1, p.name, type_label(p.ty)));
        }
        if let Some(ty) = answer
            && !fits(ty, &t.expected)
        {
            return Err(format!("Test {}: the expected answer isn't a valid {}", i + 1, type_label(ty)));
        }
    }
    Ok(())
}

fn type_label(t: ParamType) -> String {
    serde_json::to_value(t).ok().and_then(|v| v.as_str().map(str::to_string)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn checks_shapes() {
        assert!(fits(ParamType::IntArray, &json!([1, 2])));
        assert!(!fits(ParamType::IntArray, &json!([1.5])));
        assert!(fits(ParamType::TreeNode, &json!([1, null, 2])));
        assert!(!fits(ParamType::TreeNode, &json!([null, 1])));
        assert!(fits(ParamType::CharMatrix, &json!([["a", "b"]])));
        assert!(!fits(ParamType::CharMatrix, &json!([["ab"]])));
        assert!(is_identifier("two_sum2") && !is_identifier("2x") && !is_identifier("a-b"));
    }
}
