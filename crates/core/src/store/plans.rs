//! Study plans: ordered lists of questions with progress.

use rusqlite::{OptionalExtension, params};

use super::{Result, Store, StoreError, new_id, now};
use crate::types::{PlanDetail, PlanForm, PlanSummary, ProblemStatus, ProblemSummary};

impl Store {
    fn plan_items(&self, id: &str) -> Result<Vec<ProblemSummary>> {
        let summaries = self.summaries()?;
        let mut stmt =
            self.conn.prepare("SELECT problem_id FROM study_plan_items WHERE plan_id = ?1 ORDER BY position")?;
        let ids = stmt.query_map([id], |r| r.get::<_, String>(0))?.collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(ids.iter().filter_map(|pid| summaries.iter().find(|p| &p.id == pid).cloned()).collect())
    }

    fn plan_row(&self, id: &str) -> Result<(String, String, bool, String)> {
        self.conn
            .query_row("SELECT name, description, builtin, updated_at FROM study_plans WHERE id = ?1", [id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })
            .optional()?
            .ok_or_else(|| StoreError::NotFound(format!("study plan {id}")))
    }

    pub(crate) fn plan_summary(&self, id: &str) -> Result<PlanSummary> {
        self.get_plan(id).map(|p| p.summary)
    }

    pub fn get_plan(&self, id: &str) -> Result<PlanDetail> {
        let (name, description, builtin, updated_at) = self.plan_row(id)?;
        let items = self.plan_items(id)?;
        let solved = items.iter().filter(|p| p.status == ProblemStatus::Solved).count() as i64;
        Ok(PlanDetail {
            summary: PlanSummary {
                id: id.into(),
                name,
                description,
                builtin,
                solved,
                total: items.len() as i64,
                next: items.iter().find(|p| p.status != ProblemStatus::Solved).cloned(),
                updated_at,
            },
            items,
        })
    }

    pub fn list_plans(&self) -> Result<Vec<PlanSummary>> {
        let mut stmt = self.conn.prepare("SELECT id FROM study_plans ORDER BY builtin DESC, updated_at DESC")?;
        let ids = stmt.query_map([], |r| r.get::<_, String>(0))?.collect::<std::result::Result<Vec<_>, _>>()?;
        ids.iter().map(|id| self.plan_summary(id)).collect()
    }

    fn editable_plan(&self, id: &str) -> Result<()> {
        let (_, _, builtin, _) = self.plan_row(id)?;
        if builtin {
            return Err(StoreError::Invalid("Built-in plans can't be changed. Duplicate it first.".into()));
        }
        Ok(())
    }

    pub fn save_plan(&self, form: &PlanForm) -> Result<PlanSummary> {
        let name = form.name.trim();
        if !(2..=60).contains(&name.chars().count()) {
            return Err(StoreError::Invalid("Plan names are 2–60 characters".into()));
        }
        let stamp = now();
        let id = match &form.id {
            Some(id) => {
                self.editable_plan(id)?;
                self.conn.execute(
                    "UPDATE study_plans SET name = ?2, description = ?3, updated_at = ?4 WHERE id = ?1",
                    params![id, name, form.description.trim(), stamp],
                )?;
                id.clone()
            }
            None => {
                let id = new_id();
                self.conn.execute(
                    "INSERT INTO study_plans (id, name, description, builtin, created_at, updated_at)
                     VALUES (?1, ?2, ?3, 0, ?4, ?4)",
                    params![id, name, form.description.trim(), stamp],
                )?;
                id
            }
        };
        self.plan_summary(&id)
    }

    pub fn duplicate_plan(&mut self, id: &str) -> Result<PlanSummary> {
        let (name, description, _, _) = self.plan_row(id)?;
        let copy = new_id();
        let stamp = now();
        let tx = self.conn.transaction()?;
        tx.execute(
            "INSERT INTO study_plans (id, name, description, builtin, created_at, updated_at) VALUES (?1, ?2, ?3, 0, ?4, ?4)",
            params![copy, format!("{name} (copy)"), description, stamp],
        )?;
        tx.execute(
            "INSERT INTO study_plan_items (plan_id, problem_id, position)
             SELECT ?1, problem_id, position FROM study_plan_items WHERE plan_id = ?2",
            params![copy, id],
        )?;
        tx.commit()?;
        self.plan_summary(&copy)
    }

    pub fn delete_plan(&self, id: &str) -> Result<()> {
        self.editable_plan(id)?;
        self.conn.execute("DELETE FROM study_plans WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Replaces the plan's problems with `problem_ids`, in that order (duplicates dropped).
    pub fn set_plan_items(&mut self, id: &str, problem_ids: &[String]) -> Result<()> {
        self.editable_plan(id)?;
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM study_plan_items WHERE plan_id = ?1", [id])?;
        let mut seen = std::collections::HashSet::new();
        let mut position = 0i64;
        for pid in problem_ids {
            if !seen.insert(pid) {
                continue;
            }
            let inserted = tx.execute(
                "INSERT INTO study_plan_items (plan_id, problem_id, position)
                 SELECT ?1, id, ?3 FROM problems WHERE id = ?2",
                params![id, pid, position],
            )?;
            position += inserted as i64;
        }
        tx.execute("UPDATE study_plans SET updated_at = ?2 WHERE id = ?1", params![id, now()])?;
        tx.commit()?;
        Ok(())
    }
}
