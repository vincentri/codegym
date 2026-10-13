//! The built-in question bank, compiled into the binary from `problems/` at the repo root.

use include_dir::{Dir, include_dir};
use serde::Deserialize;

use crate::types::{Comparator, Difficulty, Language, ReferenceSolution, Signature, TestCase};

static BANK_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../problems");

#[derive(Debug, Clone, Deserialize)]
pub struct BankCategory {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankPlan {
    pub id: String,
    pub name: String,
    pub description: String,
    pub problem_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BankIndex {
    version: String,
    categories: Vec<BankCategory>,
    plans: Vec<BankPlan>,
    problems: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankProblem {
    pub id: String,
    pub title: String,
    pub difficulty: Difficulty,
    pub categories: Vec<String>,
    pub description_md: String,
    #[serde(default)]
    pub constraints: Vec<String>,
    #[serde(default)]
    pub hints: Vec<String>,
    pub signature: Signature,
    pub comparator: Comparator,
    #[serde(default)]
    pub in_place_arg: Option<usize>,
    pub tests: Vec<TestCase>,
    /// Reference solutions found under `problems/solutions/<language>/`.
    #[serde(skip)]
    pub references: Vec<ReferenceSolution>,
}

#[derive(Debug, Clone)]
pub struct Bank {
    pub version: String,
    pub categories: Vec<BankCategory>,
    pub plans: Vec<BankPlan>,
    pub problems: Vec<BankProblem>,
}

#[derive(Debug, thiserror::Error)]
pub enum BankError {
    #[error("question bank file {0} is missing")]
    Missing(String),
    #[error("question bank file {file} is invalid: {source}")]
    Invalid {
        file: String,
        #[source]
        source: serde_json::Error,
    },
    #[error("{0}")]
    Inconsistent(String),
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &str) -> Result<T, BankError> {
    let file = BANK_DIR.get_file(path).ok_or_else(|| BankError::Missing(path.into()))?;
    serde_json::from_slice(file.contents()).map_err(|source| BankError::Invalid { file: path.into(), source })
}

/// Loads and checks the embedded bank. Inconsistencies are bugs in `problems/`, caught by tests.
pub fn load() -> Result<Bank, BankError> {
    let index: BankIndex = read_json("bank.json")?;
    let mut problems = Vec::with_capacity(index.problems.len());
    for id in &index.problems {
        let mut p: BankProblem = read_json(&format!("{id}.json"))?;
        if &p.id != id {
            return Err(BankError::Inconsistent(format!("{id}.json declares id {}", p.id)));
        }
        for c in &p.categories {
            if !index.categories.iter().any(|k| &k.id == c) {
                return Err(BankError::Inconsistent(format!("{id}: unknown category {c}")));
            }
        }
        for language in Language::ALL {
            let path = format!("solutions/{}/{id}.{}", language.as_str(), language.extension());
            if let Some(f) = BANK_DIR.get_file(&path) {
                p.references
                    .push(ReferenceSolution { language, code: String::from_utf8_lossy(f.contents()).into_owned() });
            }
        }
        problems.push(p);
    }
    for plan in &index.plans {
        for pid in &plan.problem_ids {
            if !index.problems.contains(pid) {
                return Err(BankError::Inconsistent(format!("plan {}: unknown problem {pid}", plan.id)));
            }
        }
    }
    Ok(Bank { version: index.version, categories: index.categories, plans: index.plans, problems })
}
