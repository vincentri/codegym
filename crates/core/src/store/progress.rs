//! Submissions, solve records, practice time, stats and the dashboard.

use std::collections::BTreeSet;

use chrono::{DateTime, Days, NaiveDate, Utc};
use rusqlite::{OptionalExtension, params};

use super::{Result, Store, StoreError, new_id, now, parse_language};
use crate::types::{
    ActivityEvent, ByDifficulty, ContinueProblem, Dashboard, Difficulty, DifficultyCount, Language, ProblemOrigin,
    ProblemStatus, RecentSubmission, RunResult, Stats, Submission, Suggestion, Verdict,
};

fn submission_from_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Submission> {
    Ok(Submission {
        id: r.get(0)?,
        problem_id: r.get(1)?,
        language: parse_language(&r.get::<_, String>(2)?),
        verdict: Verdict::parse(&r.get::<_, String>(3)?),
        passed: r.get(4)?,
        total: r.get(5)?,
        runtime_ms: r.get(6)?,
        created_at: r.get(7)?,
        code: r.get(8)?,
    })
}

const SUBMISSION_COLUMNS: &str = "id, problem_id, language, verdict, passed, total, runtime_ms, created_at, code";

impl Store {
    pub fn list_submissions(&self, problem_id: &str) -> Result<Vec<Submission>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT {SUBMISSION_COLUMNS} FROM submissions WHERE problem_id = ?1 ORDER BY created_at DESC, rowid DESC"
        ))?;
        let rows = stmt.query_map([problem_id], submission_from_row)?;
        Ok(rows.collect::<std::result::Result<_, _>>()?)
    }

    fn event(
        &self,
        kind: &str,
        problem_id: Option<&str>,
        language: Option<Language>,
        payload: serde_json::Value,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO activity_events (ts, type, problem_id, language, payload_json) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![now(), kind, problem_id, language.map(|l| l.as_str()), payload.to_string()],
        )?;
        Ok(())
    }

    /// Logs a Run (example tests only). Runs never change progress.
    pub fn record_run(&self, problem_id: &str, language: Language, run: &RunResult) -> Result<()> {
        self.event(
            "run",
            Some(problem_id),
            Some(language),
            serde_json::json!({ "verdict": run.verdict.as_str(), "passed": run.passed, "total": run.total }),
        )
    }

    /// Records a Submit in one transaction: the submission, progress, the solve record when it
    /// passed every test, and the activity events. Returns the submission and whether it was the
    /// first solve of this problem.
    pub fn record_submission(
        &mut self,
        problem_id: &str,
        language: Language,
        code: &str,
        run: &RunResult,
    ) -> Result<(Submission, bool)> {
        let difficulty: String = self
            .conn
            .query_row("SELECT difficulty FROM problems WHERE id = ?1", [problem_id], |r| r.get(0))
            .optional()?
            .ok_or_else(|| StoreError::NotFound(format!("question {problem_id}")))?;
        let accepted = run.verdict == Verdict::Accepted;
        let stamp = now();
        let submission = Submission {
            id: new_id(),
            problem_id: problem_id.into(),
            language,
            verdict: run.verdict,
            passed: run.passed as i64,
            total: run.total as i64,
            runtime_ms: Some(run.total_time_ms),
            created_at: stamp.clone(),
            code: code.into(),
        };

        let tx = self.conn.transaction()?;
        let prior_attempts: i64 =
            tx.query_row("SELECT COUNT(*) FROM submissions WHERE problem_id = ?1", [problem_id], |r| r.get(0))?;
        let last_solve: Option<String> = tx
            .query_row("SELECT MAX(solved_at) FROM solves WHERE problem_id = ?1", [problem_id], |r| r.get(0))
            .optional()?
            .flatten();
        let already_solved: bool =
            tx.query_row("SELECT EXISTS (SELECT 1 FROM solves WHERE problem_id = ?1)", [problem_id], |r| r.get(0))?;

        tx.execute(
            &format!("INSERT INTO submissions ({SUBMISSION_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"),
            params![
                submission.id,
                problem_id,
                language.as_str(),
                run.verdict.as_str(),
                submission.passed,
                submission.total,
                submission.runtime_ms,
                stamp,
                code
            ],
        )?;
        tx.execute(
            "INSERT INTO progress (problem_id, status, attempts, first_solved_at) VALUES (?1, ?2, 1, ?3)
             ON CONFLICT(problem_id) DO UPDATE SET
               attempts = attempts + 1,
               status = CASE WHEN status = 'solved' OR ?2 = 'solved' THEN 'solved' ELSE 'attempted' END,
               first_solved_at = COALESCE(first_solved_at, ?3)",
            params![problem_id, if accepted { "solved" } else { "attempted" }, accepted.then(|| stamp.clone())],
        )?;
        tx.execute(
            "INSERT INTO activity_events (ts, type, problem_id, language, payload_json) VALUES (?1, 'submit', ?2, ?3, ?4)",
            params![
                stamp, problem_id, language.as_str(),
                serde_json::json!({ "verdict": run.verdict.as_str(), "passed": run.passed, "total": run.total }).to_string()
            ],
        )?;

        if accepted {
            // Everything since the previous solve of this problem counts toward this one.
            let since = last_solve.unwrap_or_default();
            let hints_used: i64 = tx.query_row(
                "SELECT COUNT(*) FROM activity_events WHERE problem_id = ?1 AND type = 'hint_used' AND ts > ?2",
                params![problem_id, since],
                |r| r.get(0),
            )?;
            let solution_revealed: bool = tx.query_row(
                "SELECT EXISTS (SELECT 1 FROM activity_events WHERE problem_id = ?1 AND type = 'solution_revealed' AND ts > ?2)",
                params![problem_id, since],
                |r| r.get(0),
            )?;
            let time_spent: i64 = tx.query_row(
                "SELECT COALESCE(SUM(active_sec), 0) FROM practice_sessions WHERE problem_id = ?1 AND started_at > ?2",
                params![problem_id, since],
                |r| r.get(0),
            )?;
            tx.execute(
                "INSERT INTO solves (id, problem_id, language, submission_id, difficulty, solved_at, time_spent_sec,
                   attempts_before_solve, hints_used, solution_revealed, runtime_ms, is_first_solve)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    new_id(),
                    problem_id,
                    language.as_str(),
                    submission.id,
                    difficulty,
                    stamp,
                    time_spent,
                    prior_attempts,
                    hints_used,
                    solution_revealed,
                    submission.runtime_ms,
                    !already_solved
                ],
            )?;
            tx.execute(
                "INSERT INTO activity_events (ts, type, problem_id, language, payload_json) VALUES (?1, 'solved', ?2, ?3, ?4)",
                params![stamp, problem_id, language.as_str(), serde_json::json!({ "firstSolve": !already_solved }).to_string()],
            )?;
        }
        tx.commit()?;
        Ok((submission, accepted && !already_solved))
    }

    /// Tracks practice time and opens/closes practice sessions.
    pub fn record_activity(&self, event: &ActivityEvent) -> Result<()> {
        match event {
            ActivityEvent::ProblemOpened { problem_id } => {
                self.conn.execute(
                    "INSERT INTO practice_sessions (id, problem_id, started_at, active_sec) VALUES (?1, ?2, ?3, 0)",
                    params![new_id(), problem_id, now()],
                )?;
                self.event("problem_opened", Some(problem_id), None, serde_json::json!({}))
            }
            ActivityEvent::SessionHeartbeat { problem_id, active_seconds } => {
                let seconds = (*active_seconds).clamp(0, 600);
                self.conn.execute(
                    "UPDATE practice_sessions SET active_sec = active_sec + ?2
                     WHERE id = (SELECT id FROM practice_sessions WHERE problem_id = ?1 AND ended_at IS NULL
                                 ORDER BY started_at DESC LIMIT 1)",
                    params![problem_id, seconds],
                )?;
                Ok(())
            }
            ActivityEvent::ProblemClosed { problem_id } => {
                self.conn.execute(
                    "UPDATE practice_sessions SET ended_at = ?2 WHERE problem_id = ?1 AND ended_at IS NULL",
                    params![problem_id, now()],
                )?;
                Ok(())
            }
        }
    }

    /// Mentor usage that the solve records count (hints, revealed solutions).
    pub fn record_mentor_use(&self, problem_id: &str, mode: &str) -> Result<()> {
        let kind = match mode {
            "hint" => "hint_used",
            "solution" => "solution_revealed",
            _ => "mentor_message",
        };
        self.event(kind, Some(problem_id), None, serde_json::json!({ "mode": mode }))
    }

    /// Consecutive days, ending today or yesterday (UTC), with at least one solve.
    fn streak_days(&self) -> Result<i64> {
        let mut stmt = self.conn.prepare("SELECT DISTINCT substr(solved_at, 1, 10) FROM solves")?;
        let days: BTreeSet<NaiveDate> = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .filter_map(|d| d.ok().and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()))
            .collect();
        let today = Utc::now().date_naive();
        let mut day = if days.contains(&today) {
            today
        } else {
            match today.checked_sub_days(Days::new(1)) {
                Some(y) if days.contains(&y) => y,
                _ => return Ok(0),
            }
        };
        let mut streak = 0;
        while days.contains(&day) {
            streak += 1;
            day = match day.checked_sub_days(Days::new(1)) {
                Some(d) => d,
                None => break,
            };
        }
        Ok(streak)
    }

    pub fn stats(&self) -> Result<Stats> {
        let visible: Vec<_> = self.list_problems()?;
        let count = |d: Difficulty| DifficultyCount {
            solved: visible.iter().filter(|p| p.difficulty == d && p.status == ProblemStatus::Solved).count() as i64,
            total: visible.iter().filter(|p| p.difficulty == d).count() as i64,
        };
        Ok(Stats {
            solved: visible.iter().filter(|p| p.status == ProblemStatus::Solved).count() as i64,
            total: visible.len() as i64,
            by_difficulty: ByDifficulty {
                easy: count(Difficulty::Easy),
                medium: count(Difficulty::Medium),
                hard: count(Difficulty::Hard),
            },
            streak_days: self.streak_days()?,
        })
    }

    pub fn dashboard(&self) -> Result<Dashboard> {
        let summaries = self.summaries()?;
        let find = |id: &str| summaries.iter().find(|p| p.id == id).cloned();

        let mut stmt = self.conn.prepare(&format!(
            "SELECT {SUBMISSION_COLUMNS} FROM submissions ORDER BY created_at DESC, rowid DESC LIMIT 50"
        ))?;
        let recent: Vec<Submission> =
            stmt.query_map([], submission_from_row)?.collect::<std::result::Result<_, _>>()?;

        let continue_problem = recent.iter().find_map(|s| {
            let p = find(&s.problem_id)?;
            (p.status == ProblemStatus::Attempted && !p.hidden).then(|| ContinueProblem {
                attempts: recent.iter().filter(|x| x.problem_id == s.problem_id).count() as i64,
                language: s.language,
                last_active_at: s.created_at.clone(),
                problem: p,
            })
        });

        let recent_submissions = recent
            .iter()
            .take(6)
            .filter_map(|s| Some(RecentSubmission { problem_title: find(&s.problem_id)?.title, submission: s.clone() }))
            .collect();

        // Weakest built-in topic with at least 3 visible questions and something left to solve.
        let mut suggestion: Option<Suggestion> = None;
        for c in self.list_categories()?.into_iter().filter(|c| c.builtin) {
            let list: Vec<_> = summaries
                .iter()
                .filter(|p| {
                    p.origin == ProblemOrigin::Builtin && !p.hidden && p.categories.iter().any(|x| x.id == c.id)
                })
                .collect();
            let unsolved: Vec<_> = list.iter().filter(|p| p.status != ProblemStatus::Solved).collect();
            if list.len() < 3 || unsolved.is_empty() {
                continue;
            }
            let solved = (list.len() - unsolved.len()) as i64;
            let better = suggestion
                .as_ref()
                .is_none_or(|s| (solved as f64 / list.len() as f64) < (s.solved as f64 / s.total as f64));
            if better {
                suggestion = Some(Suggestion {
                    topic: c.name.clone(),
                    solved,
                    total: list.len() as i64,
                    problems: unsolved.iter().take(3).map(|p| (**p).clone()).collect(),
                });
            }
        }

        let recent_plan: Option<String> = self
            .conn
            .query_row("SELECT id FROM study_plans ORDER BY updated_at DESC LIMIT 1", [], |r| r.get(0))
            .optional()?;
        let plan = recent_plan.map(|id| self.plan_summary(&id)).transpose()?;

        Ok(Dashboard { continue_problem, plan, recent_submissions, suggestion })
    }

    /// Wipes progress and history. Settings, AI profiles, categories and plans stay.
    pub fn reset_progress(&mut self, include_custom_problems: bool) -> Result<()> {
        let tx = self.conn.transaction()?;
        for table in
            ["solves", "submissions", "progress", "drafts", "chat_messages", "practice_sessions", "activity_events"]
        {
            tx.execute(&format!("DELETE FROM {table}"), [])?;
        }
        if include_custom_problems {
            tx.execute("DELETE FROM problems WHERE origin != 'builtin'", [])?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Time of the most recent activity, for diagnostics.
    pub fn last_activity(&self) -> Result<Option<DateTime<Utc>>> {
        let ts: Option<String> =
            self.conn.query_row("SELECT MAX(ts) FROM activity_events", [], |r| r.get(0)).optional()?.flatten();
        Ok(ts.and_then(|t| DateTime::parse_from_rfc3339(&t).ok()).map(|t| t.with_timezone(&Utc)))
    }
}
