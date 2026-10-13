//! Questions, test cases, categories and the built-in bank sync.

use std::collections::HashMap;

use rusqlite::{OptionalExtension, Transaction, params};

use super::{Result, Store, StoreError, from_json, now, parse_language, slugify, to_json};
use crate::bank::{self, Bank};
use crate::types::{
    BankQuestion, Category, CategoryForm, CategoryRef, Comparator, Difficulty, Problem, ProblemOrigin, ProblemStatus,
    ProblemSummary, QuestionInput, QuestionRecord, ReferenceSolution, Signature, TestCase,
};

const COLORS: [&str; 9] = ["slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"];

fn parse_difficulty(s: &str) -> Difficulty {
    match s {
        "medium" => Difficulty::Medium,
        "hard" => Difficulty::Hard,
        _ => Difficulty::Easy,
    }
}

fn parse_origin(s: &str) -> ProblemOrigin {
    match s {
        "builtin" => ProblemOrigin::Builtin,
        "ai_imported" => ProblemOrigin::AiImported,
        "ai_generated" => ProblemOrigin::AiGenerated,
        _ => ProblemOrigin::Manual,
    }
}

fn parse_comparator(s: &str) -> Comparator {
    match s {
        "unordered" => Comparator::Unordered,
        "unorderedNested" => Comparator::UnorderedNested,
        "float" => Comparator::Float,
        _ => Comparator::Exact,
    }
}

pub(crate) fn parse_status(s: Option<String>) -> ProblemStatus {
    match s.as_deref() {
        Some("solved") => ProblemStatus::Solved,
        Some("attempted") => ProblemStatus::Attempted,
        _ => ProblemStatus::Todo,
    }
}

/// Checks a question before it is written. The editor's Zod schema enforces the same rules.
fn validate(input: &QuestionInput) -> Result<()> {
    crate::values::validate_question(input).map_err(StoreError::Invalid)
}

fn write_tests(tx: &Transaction, id: &str, tests: &[TestCase]) -> Result<()> {
    tx.execute("DELETE FROM test_cases WHERE problem_id = ?1", [id])?;
    let mut stmt = tx.prepare(
        "INSERT INTO test_cases (problem_id, idx, input_json, expected_json, hidden) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    for (i, t) in tests.iter().enumerate() {
        stmt.execute(params![id, i as i64, to_json(&t.input)?, to_json(&t.expected)?, t.hidden])?;
    }
    Ok(())
}

fn write_categories(tx: &Transaction, id: &str, category_ids: &[String]) -> Result<()> {
    tx.execute("DELETE FROM problem_categories WHERE problem_id = ?1", [id])?;
    for cid in category_ids {
        tx.execute(
            "INSERT OR IGNORE INTO problem_categories (problem_id, category_id)
             SELECT ?1, id FROM categories WHERE id = ?2",
            params![id, cid],
        )?;
    }
    Ok(())
}

impl Store {
    // --- built-in bank -----------------------------------------------------------

    /// Brings built-in questions, categories and plans up to date with the embedded bank.
    /// Runs on every start but only writes when the bank version changed.
    pub(crate) fn sync_bank(&mut self) -> Result<()> {
        let bank = bank::load().map_err(|e| StoreError::Invalid(e.to_string()))?;
        if self.setting::<String>("bank_version")?.as_deref() == Some(bank.version.as_str()) {
            return Ok(());
        }
        self.apply_bank(&bank)?;
        self.set_setting("bank_version", &bank.version)
    }

    fn apply_bank(&mut self, bank: &Bank) -> Result<()> {
        let tx = self.conn.transaction()?;
        let stamp = now();
        for c in &bank.categories {
            tx.execute(
                "INSERT INTO categories (id, name, color, description, builtin) VALUES (?1, ?2, ?3, '', 1)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, builtin = 1",
                params![c.id, c.name, c.color],
            )?;
        }
        for (pos, p) in bank.problems.iter().enumerate() {
            tx.execute(
                "INSERT INTO problems (id, position, title, difficulty, description_md, constraints_json,
                   hints_json, signature_json, comparator, in_place_arg, origin, forked_from, bank_version,
                   created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'builtin', NULL, ?11, ?12, ?12)
                 ON CONFLICT(id) DO UPDATE SET position = excluded.position, title = excluded.title,
                   difficulty = excluded.difficulty, description_md = excluded.description_md,
                   constraints_json = excluded.constraints_json, hints_json = excluded.hints_json,
                   signature_json = excluded.signature_json, comparator = excluded.comparator,
                   in_place_arg = excluded.in_place_arg, bank_version = excluded.bank_version,
                   updated_at = excluded.updated_at",
                params![
                    p.id,
                    pos as i64,
                    p.title,
                    p.difficulty.as_str(),
                    p.description_md,
                    to_json(&p.constraints)?,
                    to_json(&p.hints)?,
                    to_json(&p.signature)?,
                    p.comparator.as_str(),
                    p.in_place_arg.map(|i| i as i64),
                    bank.version,
                    stamp
                ],
            )?;
            write_tests(&tx, &p.id, &p.tests)?;
            // Built-in topics are (re)added; tags you added yourself stay.
            for cid in &p.categories {
                tx.execute(
                    "INSERT OR IGNORE INTO problem_categories (problem_id, category_id) VALUES (?1, ?2)",
                    params![p.id, cid],
                )?;
            }
            tx.execute("DELETE FROM reference_solutions WHERE problem_id = ?1", [&p.id])?;
            for r in &p.references {
                tx.execute(
                    "INSERT INTO reference_solutions (problem_id, language, code, verified_at) VALUES (?1, ?2, ?3, ?4)",
                    params![p.id, r.language.as_str(), r.code, stamp],
                )?;
            }
        }
        // Your own questions come after the built-ins.
        let builtin_count = bank.problems.len() as i64;
        tx.execute(
            "UPDATE problems SET position = position + ?1 WHERE origin != 'builtin' AND position < ?1",
            [builtin_count],
        )?;
        for plan in &bank.plans {
            tx.execute(
                "INSERT INTO study_plans (id, name, description, builtin, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 1, ?4, ?4)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description",
                params![plan.id, plan.name, plan.description, stamp],
            )?;
            tx.execute("DELETE FROM study_plan_items WHERE plan_id = ?1", [&plan.id])?;
            for (i, pid) in plan.problem_ids.iter().enumerate() {
                tx.execute(
                    "INSERT INTO study_plan_items (plan_id, problem_id, position) VALUES (?1, ?2, ?3)",
                    params![plan.id, pid, i as i64],
                )?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    // --- summaries -----------------------------------------------------------------

    fn category_refs(&self) -> Result<HashMap<String, Vec<CategoryRef>>> {
        let mut stmt = self.conn.prepare(
            "SELECT pc.problem_id, c.id, c.name, c.color FROM problem_categories pc
             JOIN categories c ON c.id = pc.category_id
             ORDER BY c.builtin DESC, c.name COLLATE NOCASE",
        )?;
        let mut map: HashMap<String, Vec<CategoryRef>> = HashMap::new();
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, CategoryRef { id: r.get(1)?, name: r.get(2)?, color: r.get(3)? }))
        })?;
        for row in rows {
            let (pid, c) = row?;
            map.entry(pid).or_default().push(c);
        }
        Ok(map)
    }

    /// Every question in display order, numbered from 1.
    pub(crate) fn summaries(&self) -> Result<Vec<ProblemSummary>> {
        let mut cats = self.category_refs()?;
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.title, p.difficulty, p.origin, COALESCE(pp.hidden, 0), pr.status
             FROM problems p
             LEFT JOIN problem_prefs pp ON pp.problem_id = p.id
             LEFT JOIN progress pr ON pr.problem_id = p.id
             ORDER BY p.position, p.created_at",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, bool>(4)?,
                r.get::<_, Option<String>>(5)?,
            ))
        })?;
        let mut out = Vec::new();
        for (i, row) in rows.enumerate() {
            let (id, title, difficulty, origin, hidden, status) = row?;
            out.push(ProblemSummary {
                categories: cats.remove(&id).unwrap_or_default(),
                id,
                number: i as i64 + 1,
                title,
                difficulty: parse_difficulty(&difficulty),
                origin: parse_origin(&origin),
                hidden,
                status: parse_status(status),
            });
        }
        Ok(out)
    }

    pub(crate) fn summary(&self, id: &str) -> Result<ProblemSummary> {
        self.summaries()?.into_iter().find(|p| p.id == id).ok_or_else(|| StoreError::NotFound(format!("question {id}")))
    }

    /// Questions for the Problems page (hidden ones left out).
    pub fn list_problems(&self) -> Result<Vec<ProblemSummary>> {
        Ok(self.summaries()?.into_iter().filter(|p| !p.hidden).collect())
    }

    pub fn tests(&self, id: &str) -> Result<Vec<TestCase>> {
        let mut stmt = self
            .conn
            .prepare("SELECT input_json, expected_json, hidden FROM test_cases WHERE problem_id = ?1 ORDER BY idx")?;
        let rows =
            stmt.query_map([id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, bool>(2)?)))?;
        let mut out = Vec::new();
        for row in rows {
            let (input, expected, hidden) = row?;
            out.push(TestCase { input: from_json(&input)?, expected: from_json(&expected)?, hidden });
        }
        Ok(out)
    }

    pub fn get_problem(&self, id: &str) -> Result<Problem> {
        let q = self.get_question(id)?;
        let summary = self.summary(id)?;
        let tests = q.input.tests;
        Ok(Problem {
            summary,
            description_md: q.input.description_md,
            constraints: q.input.constraints,
            signature: q.input.signature,
            comparator: q.input.comparator,
            in_place_arg: q.input.in_place_arg,
            hidden_test_count: tests.iter().filter(|t| t.hidden).count(),
            examples: tests.into_iter().filter(|t| !t.hidden).collect(),
        })
    }

    pub fn get_question(&self, id: &str) -> Result<QuestionRecord> {
        type Row = (String, String, String, String, String, String, String, Option<i64>, String, Option<String>);
        let row: Option<Row> = self
            .conn
            .query_row(
                "SELECT title, difficulty, description_md, constraints_json, hints_json, signature_json,
                   comparator, in_place_arg, origin, forked_from FROM problems WHERE id = ?1",
                [id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                        r.get(7)?,
                        r.get(8)?,
                        r.get(9)?,
                    ))
                },
            )
            .optional()?;
        let (
            title,
            difficulty,
            description_md,
            constraints,
            hints,
            signature,
            comparator,
            in_place,
            origin,
            forked_from,
        ) = row.ok_or_else(|| StoreError::NotFound(format!("question {id}")))?;
        let category_ids = {
            let mut stmt = self.conn.prepare("SELECT category_id FROM problem_categories WHERE problem_id = ?1")?;
            stmt.query_map([id], |r| r.get::<_, String>(0))?.collect::<std::result::Result<Vec<_>, _>>()?
        };
        let reference: Option<ReferenceSolution> = self
            .conn
            .query_row(
                "SELECT language, code FROM reference_solutions WHERE problem_id = ?1
                 ORDER BY CASE language WHEN 'javascript' THEN 0 WHEN 'python' THEN 1 ELSE 2 END LIMIT 1",
                [id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .optional()?
            .map(|(l, code)| ReferenceSolution { language: parse_language(&l), code });
        Ok(QuestionRecord {
            id: id.into(),
            input: QuestionInput {
                title,
                difficulty: parse_difficulty(&difficulty),
                category_ids,
                description_md,
                constraints: from_json(&constraints)?,
                hints: from_json(&hints)?,
                signature: from_json::<Signature>(&signature)?,
                comparator: parse_comparator(&comparator),
                in_place_arg: in_place.map(|i| i as usize),
                tests: self.tests(id)?,
                reference,
                origin: parse_origin(&origin),
                forked_from,
            },
        })
    }

    /// All reference solutions for a question (built-ins ship one per language).
    pub fn references(&self, id: &str) -> Result<Vec<ReferenceSolution>> {
        let mut stmt = self.conn.prepare("SELECT language, code FROM reference_solutions WHERE problem_id = ?1")?;
        let rows = stmt.query_map([id], |r| {
            Ok(ReferenceSolution { language: parse_language(&r.get::<_, String>(0)?), code: r.get(1)? })
        })?;
        Ok(rows.collect::<std::result::Result<_, _>>()?)
    }

    // --- question bank -------------------------------------------------------------

    pub fn list_bank_questions(&self) -> Result<Vec<BankQuestion>> {
        let mut meta: HashMap<String, (usize, bool, String)> = HashMap::new();
        let mut stmt = self.conn.prepare(
            "SELECT p.id, (SELECT COUNT(*) FROM test_cases t WHERE t.problem_id = p.id),
               EXISTS (SELECT 1 FROM reference_solutions r WHERE r.problem_id = p.id AND r.verified_at IS NOT NULL),
               p.updated_at
             FROM problems p",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, bool>(2)?, r.get::<_, String>(3)?))
        })?;
        for row in rows {
            let (id, n, v, u) = row?;
            meta.insert(id, (n as usize, v, u));
        }
        Ok(self
            .summaries()?
            .into_iter()
            .map(|s| {
                let (test_count, verified, updated_at) = meta.remove(&s.id).unwrap_or_default();
                BankQuestion { summary: s, test_count, verified, updated_at }
            })
            .collect())
    }

    pub fn create_question(&mut self, input: &QuestionInput) -> Result<QuestionRecord> {
        if input.origin == ProblemOrigin::Builtin {
            return Err(StoreError::Invalid("New questions can't be built-in".into()));
        }
        validate(input)?;
        let base = match slugify(&input.title) {
            s if s.is_empty() => "question".to_string(),
            s => s,
        };
        let mut id = base.clone();
        let mut n = 2;
        while self.question_exists(&id)? {
            id = format!("{base}-{n}");
            n += 1;
        }
        let position: i64 =
            self.conn.query_row("SELECT COALESCE(MAX(position), -1) + 1 FROM problems", [], |r| r.get(0))?;
        let stamp = now();
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO problems (id, position, title, difficulty, description_md, constraints_json, hints_json,
               signature_json, comparator, in_place_arg, origin, forked_from, bank_version, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, ?13, ?13)",
            params![
                id,
                position,
                input.title.trim(),
                input.difficulty.as_str(),
                input.description_md,
                to_json(&input.constraints)?,
                to_json(&input.hints)?,
                to_json(&input.signature)?,
                input.comparator.as_str(),
                input.in_place_arg.map(|i| i as i64),
                input.origin.as_str(),
                input.forked_from,
                stamp
            ],
        )?;
        write_tests(&tx, &id, &input.tests)?;
        write_categories(&tx, &id, &input.category_ids)?;
        if let Some(r) = &input.reference {
            tx.execute(
                "INSERT INTO reference_solutions (problem_id, language, code, verified_at) VALUES (?1, ?2, ?3, NULL)",
                params![id, r.language.as_str(), r.code],
            )?;
        }
        tx.execute(
            "INSERT INTO activity_events (ts, type, problem_id, payload_json) VALUES (?1, 'question_created', ?2, ?3)",
            params![stamp, id, serde_json::json!({ "origin": input.origin.as_str() }).to_string()],
        )?;
        tx.commit()?;
        self.get_question(&id)
    }

    fn question_exists(&self, id: &str) -> Result<bool> {
        Ok(self.conn.query_row("SELECT EXISTS (SELECT 1 FROM problems WHERE id = ?1)", [id], |r| r.get(0))?)
    }

    fn origin_of(&self, id: &str) -> Result<ProblemOrigin> {
        let o: Option<String> =
            self.conn.query_row("SELECT origin FROM problems WHERE id = ?1", [id], |r| r.get(0)).optional()?;
        o.map(|s| parse_origin(&s)).ok_or_else(|| StoreError::NotFound(format!("question {id}")))
    }

    pub fn update_question(&mut self, id: &str, input: &QuestionInput) -> Result<QuestionRecord> {
        if self.origin_of(id)? == ProblemOrigin::Builtin {
            return Err(StoreError::Invalid("Built-in questions are read-only. Duplicate it to edit.".into()));
        }
        validate(input)?;
        let tx = self.conn.transaction()?;
        tx.execute(
            "UPDATE problems SET title = ?2, difficulty = ?3, description_md = ?4, constraints_json = ?5,
               hints_json = ?6, signature_json = ?7, comparator = ?8, in_place_arg = ?9, updated_at = ?10
             WHERE id = ?1",
            params![
                id,
                input.title.trim(),
                input.difficulty.as_str(),
                input.description_md,
                to_json(&input.constraints)?,
                to_json(&input.hints)?,
                to_json(&input.signature)?,
                input.comparator.as_str(),
                input.in_place_arg.map(|i| i as i64),
                now()
            ],
        )?;
        write_tests(&tx, id, &input.tests)?;
        write_categories(&tx, id, &input.category_ids)?;
        tx.execute("DELETE FROM reference_solutions WHERE problem_id = ?1", [id])?;
        if let Some(r) = &input.reference {
            tx.execute(
                "INSERT INTO reference_solutions (problem_id, language, code, verified_at) VALUES (?1, ?2, ?3, NULL)",
                params![id, r.language.as_str(), r.code],
            )?;
        }
        tx.commit()?;
        self.get_question(id)
    }

    /// Records that a question's reference solution agreed with all of its tests.
    pub fn mark_verified(&self, id: &str, verified: bool) -> Result<()> {
        self.conn.execute(
            "UPDATE reference_solutions SET verified_at = CASE WHEN ?2 THEN ?3 ELSE NULL END WHERE problem_id = ?1",
            params![id, verified, now()],
        )?;
        Ok(())
    }

    /// Deletes your own questions with everything attached to them (cascades).
    pub fn delete_questions(&mut self, ids: &[String]) -> Result<()> {
        for id in ids {
            if self.origin_of(id)? == ProblemOrigin::Builtin {
                return Err(StoreError::Invalid("Built-in questions can't be deleted. Hide them instead.".into()));
            }
        }
        let tx = self.conn.transaction()?;
        for id in ids {
            tx.execute("DELETE FROM problems WHERE id = ?1", [id])?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn set_hidden(&self, ids: &[String], hidden: bool) -> Result<()> {
        for id in ids {
            self.conn.execute(
                "INSERT INTO problem_prefs (problem_id, hidden) VALUES (?1, ?2)
                 ON CONFLICT(problem_id) DO UPDATE SET hidden = excluded.hidden",
                params![id, hidden],
            )?;
        }
        Ok(())
    }

    // --- categories ----------------------------------------------------------------

    pub fn list_categories(&self) -> Result<Vec<Category>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.name, c.color, c.description, c.builtin,
               (SELECT COUNT(*) FROM problem_categories pc WHERE pc.category_id = c.id),
               (SELECT COUNT(*) FROM problem_categories pc JOIN progress pr ON pr.problem_id = pc.problem_id
                  WHERE pc.category_id = c.id AND pr.status = 'solved')
             FROM categories c ORDER BY c.builtin, c.name COLLATE NOCASE",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Category {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
                description: r.get(3)?,
                builtin: r.get(4)?,
                question_count: r.get(5)?,
                solved_count: r.get(6)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<_, _>>()?)
    }

    pub fn save_category(&self, form: &CategoryForm) -> Result<Category> {
        let name = form.name.trim();
        if !(2..=32).contains(&name.chars().count()) {
            return Err(StoreError::Invalid("Category names are 2–32 characters".into()));
        }
        if !COLORS.contains(&form.color.as_str()) {
            return Err(StoreError::Invalid(format!("Unknown color {}", form.color)));
        }
        let clash: Option<String> = self
            .conn
            .query_row(
                "SELECT id FROM categories WHERE name = ?1 COLLATE NOCASE AND id IS NOT ?2",
                params![name, form.id],
                |r| r.get(0),
            )
            .optional()?;
        if clash.is_some() {
            return Err(StoreError::Invalid("A category with this name exists".into()));
        }
        let id = match &form.id {
            Some(id) => {
                let builtin: Option<bool> = self
                    .conn
                    .query_row("SELECT builtin FROM categories WHERE id = ?1", [id], |r| r.get(0))
                    .optional()?;
                match builtin {
                    None => return Err(StoreError::NotFound("category".into())),
                    Some(true) => return Err(StoreError::Invalid("Built-in categories can't be changed".into())),
                    Some(false) => {}
                }
                self.conn.execute(
                    "UPDATE categories SET name = ?2, color = ?3, description = ?4 WHERE id = ?1",
                    params![id, name, form.color, form.description.trim()],
                )?;
                id.clone()
            }
            None => {
                let base = match slugify(name) {
                    s if s.is_empty() => "category".to_string(),
                    s => s,
                };
                let mut id = base.clone();
                let mut n = 2;
                while self.conn.query_row("SELECT EXISTS (SELECT 1 FROM categories WHERE id = ?1)", [&id], |r| {
                    r.get::<_, bool>(0)
                })? {
                    id = format!("{base}-{n}");
                    n += 1;
                }
                self.conn.execute(
                    "INSERT INTO categories (id, name, color, description, builtin) VALUES (?1, ?2, ?3, ?4, 0)",
                    params![id, name, form.color, form.description.trim()],
                )?;
                id
            }
        };
        self.list_categories()?.into_iter().find(|c| c.id == id).ok_or_else(|| StoreError::NotFound("category".into()))
    }

    /// Removes the tag only; questions are kept.
    pub fn delete_category(&self, id: &str) -> Result<()> {
        let builtin: Option<bool> =
            self.conn.query_row("SELECT builtin FROM categories WHERE id = ?1", [id], |r| r.get(0)).optional()?;
        if builtin == Some(true) {
            return Err(StoreError::Invalid("Built-in categories can't be deleted".into()));
        }
        self.conn.execute("DELETE FROM categories WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn set_question_categories(&mut self, ids: &[String], add: &[String], remove: &[String]) -> Result<()> {
        let tx = self.conn.transaction()?;
        for id in ids {
            for cid in remove {
                tx.execute(
                    "DELETE FROM problem_categories WHERE problem_id = ?1 AND category_id = ?2",
                    params![id, cid],
                )?;
            }
            for cid in add {
                tx.execute(
                    "INSERT OR IGNORE INTO problem_categories (problem_id, category_id)
                     SELECT ?1, id FROM categories WHERE id = ?2",
                    params![id, cid],
                )?;
            }
        }
        tx.commit()?;
        Ok(())
    }
}
