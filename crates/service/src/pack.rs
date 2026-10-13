//! Problem packs: your own questions in a `.codegym.json` file you can share. A pack carries
//! each question in full (statement, signature, tests, reference solution) plus the custom
//! categories they use; built-in categories are referenced by id.

use std::path::Path;

use codegym_core::values::validate_question;
use codegym_core::{CategoryForm, ProblemOrigin, QuestionInput};
use serde::{Deserialize, Serialize};

use crate::{Result, Service, ServiceError};

pub const FORMAT: &str = "codegym-problem-pack";
pub const VERSION: u32 = 1;
/// Packs are text; anything bigger is not a pack.
const MAX_BYTES: u64 = 20 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackCategory {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemPack {
    pub format: String,
    pub version: u32,
    pub exported_at: String,
    pub categories: Vec<PackCategory>,
    pub questions: Vec<QuestionInput>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackExport {
    pub path: String,
    pub questions: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedQuestion {
    pub title: String,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackImport {
    pub imported: usize,
    pub categories_created: usize,
    pub skipped: Vec<SkippedQuestion>,
}

impl Service {
    /// The pack of every question you created (built-ins are left out).
    pub fn problem_pack(&self) -> Result<ProblemPack> {
        let bank = self.store().list_bank_questions()?;
        let mut questions = Vec::new();
        for q in bank.iter().filter(|q| q.summary.origin != ProblemOrigin::Builtin) {
            questions.push(self.store().get_question(&q.summary.id)?.input);
        }
        let categories = self
            .store()
            .list_categories()?
            .into_iter()
            .filter(|c| !c.builtin && questions.iter().any(|q| q.category_ids.contains(&c.id)))
            .map(|c| PackCategory { id: c.id, name: c.name, color: c.color, description: c.description })
            .collect();
        Ok(ProblemPack { format: FORMAT.into(), version: VERSION, exported_at: chrono_now(), categories, questions })
    }

    /// The pack as file contents, with how many questions it holds.
    pub fn problem_pack_text(&self) -> Result<(String, usize)> {
        let pack = self.problem_pack()?;
        if pack.questions.is_empty() {
            return Err(ServiceError::Invalid(
                "You haven't created any questions yet. Add or generate some in Questions first.".into(),
            ));
        }
        let json = serde_json::to_string_pretty(&pack).map_err(|e| ServiceError::Internal(e.to_string()))?;
        Ok((json + "\n", pack.questions.len()))
    }

    pub fn export_problem_pack(&self, path: &Path) -> Result<PackExport> {
        let (text, questions) = self.problem_pack_text()?;
        std::fs::write(path, text)
            .map_err(|e| ServiceError::Invalid(format!("Couldn't write {}: {e}", path.display())))?;
        Ok(PackExport { path: path.display().to_string(), questions })
    }

    pub fn import_problem_pack(&self, path: &Path) -> Result<PackImport> {
        let size = std::fs::metadata(path)
            .map_err(|e| ServiceError::Invalid(format!("Couldn't open {}: {e}", path.display())))?
            .len();
        if size > MAX_BYTES {
            return Err(ServiceError::Invalid("That file is too large to be a problem pack.".into()));
        }
        let text = std::fs::read_to_string(path)
            .map_err(|e| ServiceError::Invalid(format!("Couldn't read {}: {e}", path.display())))?;
        self.import_pack_text(&text)
    }

    /// Adds the pack's questions. Categories are matched by name and created when missing;
    /// questions that are invalid or already in your bank are skipped with a reason.
    pub fn import_pack_text(&self, text: &str) -> Result<PackImport> {
        let pack: ProblemPack = serde_json::from_str(text)
            .map_err(|e| ServiceError::Invalid(format!("This isn't a CodeGym problem pack: {e}")))?;
        if pack.format != FORMAT {
            return Err(ServiceError::Invalid("This isn't a CodeGym problem pack.".into()));
        }
        if pack.version > VERSION {
            return Err(ServiceError::Invalid(
                "This pack was made by a newer version of CodeGym. Update the app to import it.".into(),
            ));
        }

        // Pack category id → id here.
        let mut existing = self.store().list_categories()?;
        let mut category_ids = std::collections::HashMap::new();
        let mut categories_created = 0;
        for c in &pack.categories {
            let found = existing.iter().find(|e| e.name.eq_ignore_ascii_case(c.name.trim())).map(|e| e.id.clone());
            let id = match found {
                Some(id) => id,
                None => {
                    let form = CategoryForm {
                        id: None,
                        name: c.name.clone(),
                        color: c.color.clone(),
                        description: c.description.clone(),
                    };
                    match self.store().save_category(&form) {
                        Ok(created) => {
                            categories_created += 1;
                            existing.push(created.clone());
                            created.id
                        }
                        Err(_) => continue, // an invalid name or color: questions just lose that tag
                    }
                }
            };
            category_ids.insert(c.id.clone(), id);
        }
        let known: Vec<String> = existing.iter().map(|c| c.id.clone()).collect();

        let bank = self.store().list_bank_questions()?;
        let mut imported = 0;
        let mut skipped = Vec::new();
        for mut q in pack.questions {
            let title = q.title.trim().to_string();
            q.category_ids = q
                .category_ids
                .iter()
                .filter_map(|id| category_ids.get(id).cloned().or_else(|| known.contains(id).then(|| id.clone())))
                .collect();
            q.category_ids.dedup();
            if q.origin == ProblemOrigin::Builtin {
                q.origin = ProblemOrigin::Manual;
            }
            q.forked_from = None;
            if let Err(reason) = validate_question(&q) {
                skipped.push(SkippedQuestion { title, reason });
                continue;
            }
            if bank.iter().any(|b| b.summary.title.eq_ignore_ascii_case(&title)) {
                skipped.push(SkippedQuestion {
                    title,
                    reason: "a question with this title is already in your bank".into(),
                });
                continue;
            }
            match self.create_question(&q) {
                Ok(_) => imported += 1,
                Err(e) => skipped.push(SkippedQuestion { title, reason: e.to_string() }),
            }
        }
        Ok(PackImport { imported, categories_created, skipped })
    }
}

fn chrono_now() -> String {
    // Seconds since the epoch, formatted by the store's clock helper would pull in chrono here;
    // a plain RFC 3339 timestamp via std is enough for an informational field.
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    format_rfc3339(secs)
}

/// Formats seconds since the Unix epoch as `YYYY-MM-DDTHH:MM:SSZ` (UTC).
fn format_rfc3339(secs: u64) -> String {
    let days = secs / 86_400;
    let rem = secs % 86_400;
    // Civil-from-days (Howard Hinnant's algorithm).
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_timestamps() {
        assert_eq!(format_rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_rfc3339(1_791_849_600), "2026-10-13T00:00:00Z");
    }
}
