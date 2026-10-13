//! Everything the desktop UI can ask for, implemented on the SQLite store and the code runner.
//! The Tauri commands are thin wrappers around these methods, so this is where behavior is
//! tested.

mod ai;

use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use codegym_ai::{AiClient, SecretStore};
use codegym_core::{
    ActivityEvent, AiProfile, AppSettings, BankQuestion, Category, CategoryForm, ChatMessage, Dashboard, DataInfo,
    Draft, Language, PlanDetail, PlanForm, PlanSummary, Problem, ProblemSummary, QuestionInput, QuestionRecord,
    ResetProgressRequest, RunRequest, RunResult, RuntimeInfo, Stats, Store, StoreError, Submission, SubmitResult,
    VerifyCase, VerifyRequest, VerifyResult,
};
use codegym_runner::{Limits, RunCase, RunSpec, Runner, RunnerConfig, Trust, starter_code};
use serde::Serialize;

/// An error the UI can show as is.
#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "snake_case")]
pub enum ServiceError {
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Unavailable(String),
    #[error("{0}")]
    Internal(String),
}

impl From<StoreError> for ServiceError {
    fn from(e: StoreError) -> Self {
        match e {
            StoreError::NotFound(what) => Self::NotFound(format!("{what} not found")),
            StoreError::Invalid(why) => Self::Invalid(why),
            other => Self::Internal(other.to_string()),
        }
    }
}

pub type Result<T> = std::result::Result<T, ServiceError>;

pub struct Service {
    store: Mutex<Store>,
    runner: Runner,
    ai: AiClient,
    /// Where API keys live (the OS keychain in the app).
    secrets: Arc<dyn SecretStore>,
}

impl Service {
    pub fn open(db_path: &Path, runner: RunnerConfig, secrets: Arc<dyn SecretStore>) -> Result<Self> {
        Ok(Self::new(Store::open(db_path)?, runner, secrets))
    }

    pub fn new(store: Store, runner: RunnerConfig, secrets: Arc<dyn SecretStore>) -> Self {
        Self { store: Mutex::new(store), runner: Runner::new(runner), ai: AiClient::new(), secrets }
    }

    /// Prepares slow-to-start runtimes (the Python WebAssembly module) in the background.
    pub fn warm_up(&self) {
        self.runner.warm_up();
    }

    fn store(&self) -> MutexGuard<'_, Store> {
        // A panic while holding the lock can't leave SQLite half-written (writes are
        // transactions), so a poisoned lock is safe to keep using.
        self.store.lock().unwrap_or_else(|e| e.into_inner())
    }

    // --- problems ----------------------------------------------------------------

    pub fn list_problems(&self) -> Result<Vec<ProblemSummary>> {
        Ok(self.store().list_problems()?)
    }

    pub fn get_problem(&self, id: &str) -> Result<Problem> {
        Ok(self.store().get_problem(id)?)
    }

    pub fn get_stats(&self) -> Result<Stats> {
        Ok(self.store().stats()?)
    }

    pub fn get_dashboard(&self) -> Result<Dashboard> {
        Ok(self.store().dashboard()?)
    }

    pub fn get_draft(&self, problem_id: &str, language: Language) -> Result<Option<Draft>> {
        Ok(self.store().draft(problem_id, language)?)
    }

    pub fn save_draft(&self, problem_id: &str, language: Language, code: &str) -> Result<Draft> {
        Ok(self.store().save_draft(problem_id, language, code)?)
    }

    pub fn starter_code(&self, problem_id: &str, language: Language) -> Result<String> {
        let problem = self.store().get_problem(problem_id)?;
        Ok(starter_code(&problem.signature, language))
    }

    // --- running -----------------------------------------------------------------

    fn limits(&self) -> Result<Limits> {
        let settings = self.store().settings()?;
        Ok(Limits { timeout: Duration::from_secs(settings.run_timeout_seconds.max(1) as u64), ..Limits::default() })
    }

    /// Loads what's needed to run a problem, then releases the store while the code runs.
    fn spec(&self, req: &RunRequest, include_hidden: bool) -> Result<RunSpec> {
        let store = self.store();
        let problem = store.get_problem(&req.problem_id)?;
        let tests = store.tests(&req.problem_id)?;
        let mut cases: Vec<RunCase> = tests
            .into_iter()
            .filter(|t| include_hidden || !t.hidden)
            .map(|t| RunCase { input: t.input, expected: Some(t.expected), hidden: t.hidden })
            .collect();
        if !include_hidden {
            cases.extend(req.custom_inputs.iter().map(|input| RunCase {
                input: input.clone(),
                expected: None,
                hidden: false,
            }));
        }
        Ok(RunSpec {
            signature: problem.signature,
            comparator: problem.comparator,
            in_place_arg: problem.in_place_arg,
            cases,
        })
    }

    /// Runs the visible examples plus any custom inputs.
    pub fn run_code(&self, req: &RunRequest) -> Result<RunResult> {
        let spec = self.spec(req, false)?;
        let limits = self.limits()?;
        self.store().save_draft(&req.problem_id, req.language, &req.code)?;
        let result = self.runner.run(req.language, &req.code, &spec, limits, Trust::User);
        self.store().record_run(&req.problem_id, req.language, &result)?;
        Ok(result)
    }

    /// Runs every test, including hidden ones, and records the submission (and the solve, when
    /// it passes).
    pub fn submit_code(&self, req: &RunRequest) -> Result<SubmitResult> {
        let spec = self.spec(req, true)?;
        let limits = self.limits()?;
        self.store().save_draft(&req.problem_id, req.language, &req.code)?;
        let run = self.runner.run(req.language, &req.code, &spec, limits, Trust::User);
        let (submission, first_solve) =
            self.store().record_submission(&req.problem_id, req.language, &req.code, &run)?;
        Ok(SubmitResult { run, submission, first_solve })
    }

    pub fn list_submissions(&self, problem_id: &str) -> Result<Vec<Submission>> {
        Ok(self.store().list_submissions(problem_id)?)
    }

    pub fn record_activity(&self, event: &ActivityEvent) -> Result<()> {
        Ok(self.store().record_activity(event)?)
    }

    /// Runs a reference solution from the question editor and reports each test's output.
    pub fn verify_reference(&self, req: &VerifyRequest, trust: Trust) -> Result<VerifyResult> {
        let spec = RunSpec {
            signature: req.signature.clone(),
            comparator: req.comparator,
            in_place_arg: req.in_place_arg,
            cases: req
                .tests
                .iter()
                .map(|t| RunCase { input: t.input.clone(), expected: Some(t.expected.clone()), hidden: false })
                .collect(),
        };
        let limits = self.limits()?;
        let run = self.runner.run(req.language, &req.code, &spec, limits, trust);
        if run.results.is_empty() {
            return Ok(VerifyResult {
                results: vec![],
                executed: false,
                note: Some(run.compile_output.unwrap_or_else(|| "The reference solution didn't run.".into())),
            });
        }
        Ok(VerifyResult {
            results: run
                .results
                .into_iter()
                .map(|r| VerifyCase {
                    index: r.index,
                    actual: r.actual.unwrap_or(serde_json::Value::Null),
                    passed: r.passed == Some(true),
                    error: r.error,
                })
                .collect(),
            executed: true,
            note: None,
        })
    }

    // --- settings and data -------------------------------------------------------

    pub fn get_settings(&self) -> Result<AppSettings> {
        Ok(self.store().settings()?)
    }

    pub fn update_settings(&self, settings: &AppSettings) -> Result<AppSettings> {
        Ok(self.store().update_settings(settings)?)
    }

    pub fn detect_runtimes(&self) -> Vec<RuntimeInfo> {
        self.runner.runtimes()
    }

    pub fn data_info(&self) -> Result<DataInfo> {
        Ok(self.store().data_info()?)
    }

    pub fn reset_progress(&self, req: &ResetProgressRequest) -> Result<()> {
        Ok(self.store().reset_progress(req.include_custom_problems)?)
    }

    // --- AI profiles and chat history (the AI calls themselves come with the mentor) ----

    pub fn list_ai_profiles(&self) -> Result<Vec<AiProfile>> {
        Ok(self.store().ai_profiles()?)
    }

    pub fn set_active_ai_profile(&self, id: &str) -> Result<()> {
        Ok(self.store().set_active_ai_profile(id)?)
    }

    pub fn list_chat(&self, problem_id: &str) -> Result<Vec<ChatMessage>> {
        Ok(self.store().chat(problem_id)?)
    }

    pub fn clear_chat(&self, problem_id: &str) -> Result<()> {
        Ok(self.store().clear_chat(problem_id)?)
    }

    // --- question bank -----------------------------------------------------------

    pub fn list_bank_questions(&self) -> Result<Vec<BankQuestion>> {
        Ok(self.store().list_bank_questions()?)
    }

    pub fn get_question(&self, id: &str) -> Result<QuestionRecord> {
        Ok(self.store().get_question(id)?)
    }

    pub fn create_question(&self, input: &QuestionInput) -> Result<QuestionRecord> {
        let record = self.store().create_question(input)?;
        self.verify_saved(&record);
        Ok(record)
    }

    pub fn update_question(&self, id: &str, input: &QuestionInput) -> Result<QuestionRecord> {
        let record = self.store().update_question(id, input)?;
        self.verify_saved(&record);
        Ok(record)
    }

    /// Marks a saved question "verified" when its reference solution passes every test.
    fn verify_saved(&self, record: &QuestionRecord) {
        let Some(reference) = &record.input.reference else { return };
        let req = VerifyRequest {
            signature: record.input.signature.clone(),
            comparator: record.input.comparator,
            in_place_arg: record.input.in_place_arg,
            tests: record
                .input
                .tests
                .iter()
                .map(|t| codegym_core::VerifyTest { input: t.input.clone(), expected: t.expected.clone() })
                .collect(),
            language: reference.language,
            code: reference.code.clone(),
        };
        if let Ok(result) = self.verify_reference(&req, Trust::User) {
            let verified = result.executed && result.results.iter().all(|r| r.passed);
            let _ = self.store().mark_verified(&record.id, verified);
        }
    }

    pub fn delete_questions(&self, ids: &[String]) -> Result<()> {
        Ok(self.store().delete_questions(ids)?)
    }

    pub fn set_hidden(&self, ids: &[String], hidden: bool) -> Result<()> {
        Ok(self.store().set_hidden(ids, hidden)?)
    }

    // --- categories --------------------------------------------------------------

    pub fn list_categories(&self) -> Result<Vec<Category>> {
        Ok(self.store().list_categories()?)
    }

    pub fn save_category(&self, form: &CategoryForm) -> Result<Category> {
        Ok(self.store().save_category(form)?)
    }

    pub fn delete_category(&self, id: &str) -> Result<()> {
        Ok(self.store().delete_category(id)?)
    }

    pub fn set_question_categories(&self, ids: &[String], add: &[String], remove: &[String]) -> Result<()> {
        Ok(self.store().set_question_categories(ids, add, remove)?)
    }

    // --- study plans -------------------------------------------------------------

    pub fn list_plans(&self) -> Result<Vec<PlanSummary>> {
        Ok(self.store().list_plans()?)
    }

    pub fn get_plan(&self, id: &str) -> Result<PlanDetail> {
        Ok(self.store().get_plan(id)?)
    }

    pub fn save_plan(&self, form: &PlanForm) -> Result<PlanSummary> {
        Ok(self.store().save_plan(form)?)
    }

    pub fn duplicate_plan(&self, id: &str) -> Result<PlanSummary> {
        Ok(self.store().duplicate_plan(id)?)
    }

    pub fn delete_plan(&self, id: &str) -> Result<()> {
        Ok(self.store().delete_plan(id)?)
    }

    pub fn set_plan_items(&self, id: &str, problem_ids: &[String]) -> Result<()> {
        Ok(self.store().set_plan_items(id, problem_ids)?)
    }
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod ai_tests;
