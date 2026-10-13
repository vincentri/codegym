//! Grades an answer against the expected one. The frontend has a mirror of this in
//! `apps/desktop/src/lib/compare.ts` for its offline preview.

use serde_json::Value;

use crate::types::Comparator;

const FLOAT_TOLERANCE: f64 = 1e-5;

fn canonical(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_default()
}

fn sorted(items: &[Value]) -> Vec<Value> {
    let mut items = items.to_vec();
    items.sort_by_key(canonical);
    items
}

fn numbers_close(a: &Value, b: &Value) -> bool {
    match (a.as_f64(), b.as_f64()) {
        (Some(x), Some(y)) => (x - y).abs() <= FLOAT_TOLERANCE,
        _ => a == b,
    }
}

/// Integers and floats compare by value (`2` equals `2.0`), everything else structurally.
fn deep_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(_), Value::Number(_)) => a.as_f64() == b.as_f64(),
        (Value::Array(x), Value::Array(y)) => x.len() == y.len() && x.iter().zip(y).all(|(p, q)| deep_equal(p, q)),
        _ => a == b,
    }
}

pub fn answers_match(comparator: Comparator, actual: &Value, expected: &Value) -> bool {
    match comparator {
        Comparator::Exact => deep_equal(actual, expected),
        Comparator::Unordered => match (actual, expected) {
            (Value::Array(a), Value::Array(e)) => {
                a.len() == e.len() && sorted(a).iter().zip(sorted(e).iter()).all(|(x, y)| deep_equal(x, y))
            }
            _ => false,
        },
        Comparator::UnorderedNested => match (actual, expected) {
            (Value::Array(a), Value::Array(e)) => {
                let norm = |xs: &[Value]| {
                    let inner: Vec<Value> = xs
                        .iter()
                        .map(|x| match x {
                            Value::Array(ys) => Value::Array(sorted(ys)),
                            other => other.clone(),
                        })
                        .collect();
                    sorted(&inner)
                };
                a.len() == e.len() && norm(a).iter().zip(norm(e).iter()).all(|(x, y)| deep_equal(x, y))
            }
            _ => false,
        },
        Comparator::Float => match (actual, expected) {
            (Value::Array(a), Value::Array(e)) => {
                a.len() == e.len() && a.iter().zip(e).all(|(x, y)| numbers_close(x, y))
            }
            _ => numbers_close(actual, expected),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn exact_compares_order_and_value() {
        assert!(answers_match(Comparator::Exact, &json!([1, 2]), &json!([1, 2])));
        assert!(!answers_match(Comparator::Exact, &json!([2, 1]), &json!([1, 2])));
        assert!(answers_match(Comparator::Exact, &json!(2.0), &json!(2)));
        assert!(!answers_match(Comparator::Exact, &json!(null), &json!([])));
    }

    #[test]
    fn unordered_ignores_order_but_not_counts() {
        assert!(answers_match(Comparator::Unordered, &json!([2, 1]), &json!([1, 2])));
        assert!(!answers_match(Comparator::Unordered, &json!([1, 1]), &json!([1, 2])));
        assert!(!answers_match(Comparator::Unordered, &json!(1), &json!([1])));
    }

    #[test]
    fn unordered_nested_sorts_groups_and_members() {
        assert!(answers_match(
            Comparator::UnorderedNested,
            &json!([["eat", "tea"], ["bat"]]),
            &json!([["bat"], ["tea", "eat"]]),
        ));
        assert!(!answers_match(
            Comparator::UnorderedNested,
            &json!([["eat"], ["tea", "bat"]]),
            &json!([["bat"], ["tea", "eat"]]),
        ));
    }

    #[test]
    fn float_allows_tiny_differences() {
        assert!(answers_match(Comparator::Float, &json!(2.500001), &json!(2.5)));
        assert!(!answers_match(Comparator::Float, &json!(2.6), &json!(2.5)));
        assert!(answers_match(Comparator::Float, &json!([1.0, 2.0]), &json!([1, 2.000001])));
    }
}
