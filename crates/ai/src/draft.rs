//! Turns the question writer's reply into questions. Models sometimes wrap JSON in code fences or
//! add a sentence around it, so the JSON is located before parsing.

use codegym_core::{
    Comparator, Difficulty, Language, ProblemOrigin, QuestionInput, ReferenceSolution, Signature, TestCase,
};
use serde::Deserialize;
use serde_json::Value;

/// One question as the model writes it (see `prompts::writer_spec`).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionDraft {
    pub title: String,
    pub difficulty: Difficulty,
    #[serde(default)]
    pub category_ids: Vec<String>,
    pub description_md: String,
    #[serde(default)]
    pub constraints: Vec<String>,
    #[serde(default)]
    pub hints: Vec<String>,
    pub signature: Signature,
    #[serde(default)]
    pub comparator: Option<Comparator>,
    #[serde(default)]
    pub in_place_arg: Option<usize>,
    pub tests: Vec<TestCase>,
    #[serde(default)]
    pub reference_js: String,
}

impl QuestionDraft {
    /// The question to verify and show for review. Unknown category ids are dropped.
    pub fn into_input(self, origin: ProblemOrigin, known_categories: &[String]) -> QuestionInput {
        let mut category_ids: Vec<String> =
            self.category_ids.into_iter().filter(|c| known_categories.contains(c)).collect();
        category_ids.dedup();
        QuestionInput {
            title: self.title.trim().to_string(),
            difficulty: self.difficulty,
            category_ids,
            description_md: self.description_md.trim().to_string(),
            constraints: self.constraints.into_iter().map(|c| c.trim().to_string()).filter(|c| !c.is_empty()).collect(),
            hints: self.hints.into_iter().map(|h| h.trim().to_string()).filter(|h| !h.is_empty()).collect(),
            signature: self.signature,
            comparator: self.comparator.unwrap_or(Comparator::Exact),
            in_place_arg: self.in_place_arg,
            tests: self.tests,
            reference: (!self.reference_js.trim().is_empty())
                .then_some(ReferenceSolution { language: Language::Javascript, code: self.reference_js }),
            origin,
            forked_from: None,
        }
    }
}

/// The text from the first `{` or `[` to the last matching bracket.
fn bracket_span(text: &str) -> Option<&str> {
    let start = text.find(['{', '['])?;
    let close = if text.as_bytes()[start] == b'{' { '}' } else { ']' };
    let end = text.rfind(close)?;
    (end > start).then(|| &text[start..=end])
}

/// The body of the first fenced code block, if any.
fn fenced(text: &str) -> Option<&str> {
    let start = text.find("```")?;
    let after = &text[start + 3..];
    let body = &after[after.find('\n').map(|i| i + 1).unwrap_or(0)..];
    Some(body.find("```").map(|end| &body[..end]).unwrap_or(body))
}

/// Finds the JSON value in a reply. Question descriptions contain Markdown code fences inside
/// their JSON strings, so the whole reply's outer brackets are tried before any fence.
pub fn extract_json(text: &str) -> Option<&str> {
    let text = text.trim();
    let candidates = [bracket_span(text), fenced(text).and_then(|f| bracket_span(f.trim()))];
    candidates.into_iter().flatten().find(|c| serde_json::from_str::<Value>(c).is_ok()).or(candidates[0])
}

fn parse_value(text: &str) -> Result<Value, String> {
    let json = extract_json(text).ok_or("the reply contains no JSON")?;
    serde_json::from_str(json).map_err(|e| format!("the JSON is invalid: {e}"))
}

fn draft_from(v: Value) -> Result<QuestionDraft, String> {
    serde_json::from_value(v).map_err(|e| format!("a question doesn't match the format: {e}"))
}

/// Parses one question (Import).
pub fn parse_one(text: &str) -> Result<QuestionDraft, String> {
    match parse_value(text)? {
        Value::Array(mut items) if !items.is_empty() => draft_from(items.remove(0)),
        v => draft_from(v),
    }
}

/// Parses a list of questions (Generate). Accepts an array, `{"questions": [...]}` or one object.
pub fn parse_many(text: &str) -> Result<Vec<QuestionDraft>, String> {
    let items = match parse_value(text)? {
        Value::Array(items) => items,
        Value::Object(mut map) if map.get("questions").is_some_and(Value::is_array) => {
            map.remove("questions").and_then(|q| q.as_array().cloned()).unwrap_or_default()
        }
        v => vec![v],
    };
    if items.is_empty() {
        return Err("the reply has no questions".into());
    }
    items.into_iter().map(draft_from).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const DRAFT: &str = r#"{"title":"Sum All","difficulty":"easy","categoryIds":["array","nope"],
      "descriptionMd":"Add them.","signature":{"functionName":"sumAll","params":[{"name":"nums","type":"int[]"}],"returns":"int"},
      "tests":[{"input":[[1,2]],"expected":3}],"referenceJs":"function sumAll(n){return n.reduce((a,b)=>a+b,0)}"}"#;

    #[test]
    fn finds_json_in_fences_and_prose() {
        assert_eq!(extract_json("Sure!\n```json\n{\"a\": 1}\n```\nEnjoy"), Some("{\"a\": 1}"));
        assert_eq!(extract_json("Here: [1, 2] done"), Some("[1, 2]"));
        assert_eq!(extract_json("no json"), None);
        // Fences inside the JSON (in a description) must not be mistaken for the wrapper.
        let inner = r#"{"descriptionMd": "**Example**\n\n```\nnums = [2, 7]\n→ 9\n```", "x": 1}"#;
        assert_eq!(extract_json(inner), Some(inner));
        let wrapped = format!("```json\n{inner}\n```");
        assert_eq!(extract_json(&wrapped), Some(inner));
    }

    #[test]
    fn parses_drafts() {
        let d = parse_one(&format!("```\n{DRAFT}\n```")).unwrap();
        let q = d.into_input(ProblemOrigin::AiImported, &["array".into()]);
        assert_eq!(q.category_ids, ["array"]);
        assert_eq!(q.comparator, Comparator::Exact);
        assert_eq!(q.reference.unwrap().language, Language::Javascript);
        assert_eq!(parse_many(&format!("{{\"questions\": [{DRAFT}, {DRAFT}]}}")).unwrap().len(), 2);
        assert!(parse_one("{\"title\": 3}").unwrap_err().contains("format"));
        assert!(parse_one("{oops").unwrap_err().contains("no JSON") || parse_one("{oops").is_err());
    }
}
