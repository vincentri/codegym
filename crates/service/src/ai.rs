//! The AI features: provider profiles (keys in the keychain), the mentor, and questions written
//! by AI. AI-written questions are only offered after their reference solution has been run on
//! every test in the QuickJS sandbox, and each expected answer is replaced with its real output.

use std::time::Instant;

use codegym_ai::draft::{self, QuestionDraft};
use codegym_ai::{AiError, Cancel, ChatEvent, ChatRequest, ProviderConfig, Turn, Wire, prompts};
use codegym_core::values::{answer_type, fits, validate_question};
use codegym_core::{
    AiProfile, AiProfileForm, ChatMessage, ConnectionTest, GenerateProgress, GenerateRequest, GeneratedQuestion,
    Language, MentorRequest, MentorStreamEvent, ProblemOrigin, VerifyRequest, VerifyTest,
};
use codegym_runner::Trust;

use crate::{Result, Service, ServiceError};

const PROVIDERS: [&str; 4] = ["ollama", "opencode_zen", "anthropic", "custom"];
/// How many earlier messages the mentor sees.
const HISTORY: usize = 20;
/// Questions the generator can be asked for at once.
const MAX_GENERATE: usize = 5;

impl From<AiError> for ServiceError {
    fn from(e: AiError) -> Self {
        ServiceError::Unavailable(e.to_string())
    }
}

fn mentor_tokens(wire: Wire) -> u32 {
    if wire == Wire::Anthropic { 16_000 } else { 8_000 }
}

fn writer_tokens(wire: Wire) -> u32 {
    if wire == Wire::Anthropic { 64_000 } else { 16_000 }
}

impl Service {
    // --- profiles -----------------------------------------------------------------

    /// Saves a profile. A non-blank `apiKey` replaces the stored key; a blank one keeps it.
    pub fn save_ai_profile(&self, form: &AiProfileForm) -> Result<AiProfile> {
        if !PROVIDERS.contains(&form.provider.as_str()) {
            return Err(ServiceError::Invalid(format!("Unknown provider {}", form.provider)));
        }
        let id = form.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let key = form.api_key.trim();
        let has_key = if key.is_empty() {
            form.id.is_some() && self.secrets.get(&id).map_err(ServiceError::Unavailable)?.is_some()
        } else {
            self.secrets.set(&id, key).map_err(ServiceError::Unavailable)?;
            true
        };
        let saved = AiProfileForm { id: Some(id), api_key: String::new(), ..form.clone() };
        Ok(self.store().save_ai_profile(&saved, has_key)?)
    }

    pub fn delete_ai_profile(&self, id: &str) -> Result<()> {
        // The keychain may be locked or missing; the profile still goes.
        let _ = self.secrets.delete(id);
        Ok(self.store().delete_ai_profile(id)?)
    }

    /// The provider an (unsaved) form points at, using the stored key when its key is blank.
    fn provider_for_form(&self, form: &AiProfileForm) -> Result<ProviderConfig> {
        let key = match (form.api_key.trim(), &form.id) {
            ("", Some(id)) => self.secrets.get(id).map_err(ServiceError::Unavailable)?,
            ("", None) => None,
            (key, _) => Some(key.to_string()),
        };
        Ok(ProviderConfig::new(&form.provider, &form.base_url, &form.model, &form.effort, key))
    }

    fn active_provider(&self) -> Result<(AiProfile, ProviderConfig)> {
        let profiles = self.store().ai_profiles()?;
        let profile = profiles
            .into_iter()
            .find(|p| p.is_active)
            .ok_or_else(|| ServiceError::Unavailable("Connect an AI first: Settings → AI Mentor.".into()))?;
        let key =
            if profile.has_api_key { self.secrets.get(&profile.id).map_err(ServiceError::Unavailable)? } else { None };
        let cfg = ProviderConfig::new(&profile.provider, &profile.base_url, &profile.model, &profile.effort, key);
        Ok((profile, cfg))
    }

    pub async fn list_models(&self, form: &AiProfileForm) -> Result<Vec<String>> {
        let cfg = self.provider_for_form(form)?;
        Ok(self.ai.list_models(&cfg).await?)
    }

    /// Sends one tiny message and reports how long the reply took.
    pub async fn test_connection(&self, form: &AiProfileForm) -> Result<ConnectionTest> {
        let cfg = self.provider_for_form(form)?;
        let fail = |error: String| ConnectionTest { ok: false, latency_ms: None, error: Some(error) };
        if cfg.model.is_empty() {
            return Ok(fail("Choose a model first.".into()));
        }
        let turns = [Turn::user("Reply with the single word OK.")];
        let req = ChatRequest { system: "You are a connection test.", turns: &turns, max_tokens: 1024 };
        let started = Instant::now();
        match self.ai.chat(&cfg, &req, &mut |_| {}, &Cancel::new()).await {
            Ok(_) => {
                Ok(ConnectionTest { ok: true, latency_ms: Some(started.elapsed().as_secs_f64() * 1000.0), error: None })
            }
            Err(AiError::NotFound(detail)) => {
                // Say which models do exist when the model name is the problem.
                let models = self.ai.list_models(&cfg).await.unwrap_or_default();
                let error = if !models.is_empty() && !models.contains(&cfg.model) {
                    let some = models.iter().take(8).cloned().collect::<Vec<_>>().join(", ");
                    format!("Model \"{}\" isn't available here. Try one of: {some}", cfg.model)
                } else {
                    AiError::NotFound(detail).to_string()
                };
                Ok(fail(error))
            }
            Err(e) => Ok(fail(e.to_string())),
        }
    }

    // --- mentor -------------------------------------------------------------------

    /// Streams the mentor's reply to `on_event`, saving both sides of the exchange.
    pub async fn send_mentor_message(
        &self,
        req: &MentorRequest,
        on_event: &mut (dyn FnMut(MentorStreamEvent) + Send),
        cancel: &Cancel,
    ) -> Result<()> {
        let (profile, cfg) = self.active_provider()?;
        let problem = self.store().get_problem(&req.problem_id)?;
        let history = self.store().chat(&req.problem_id)?;
        let mut turns: Vec<Turn> = history
            .iter()
            .skip(history.len().saturating_sub(HISTORY))
            .map(|m| if m.role == "assistant" { Turn::assistant(&m.content) } else { Turn::user(&m.content) })
            .collect();
        // The API wants the conversation to start with the learner.
        while turns.first().is_some_and(|t| t.role == codegym_ai::Role::Assistant) {
            turns.remove(0);
        }
        turns.push(Turn::user(prompts::mentor_turn(
            &problem,
            req.language,
            &req.code,
            req.last_run.as_ref(),
            &req.mode,
            &req.message,
        )));
        self.store().append_chat(&req.problem_id, "user", &req.mode, req.message.trim())?;

        let system = prompts::mentor_system(&profile.mentor_style);
        let chat = ChatRequest { system: &system, turns: &turns, max_tokens: mentor_tokens(cfg.wire) };
        let mut text = String::new();
        let result = self
            .ai
            .chat(
                &cfg,
                &chat,
                &mut |event| match event {
                    ChatEvent::Delta(t) => {
                        text.push_str(&t);
                        on_event(MentorStreamEvent::Delta { text: t });
                    }
                    ChatEvent::Reset => {
                        text.clear();
                        on_event(MentorStreamEvent::Reset);
                    }
                },
                cancel,
            )
            .await;
        let content = match result {
            Ok(outcome) if outcome.truncated => format!("{}\n\n_(The reply hit the length limit.)_", outcome.text),
            Ok(outcome) => outcome.text,
            Err(AiError::Cancelled) if !text.trim().is_empty() => format!("{text}\n\n_(stopped)_"),
            Err(AiError::Cancelled) => return Ok(()),
            Err(e) => {
                on_event(MentorStreamEvent::Error { message: e.to_string() });
                return Ok(());
            }
        };
        let message: ChatMessage = self.store().append_chat(&req.problem_id, "assistant", &req.mode, &content)?;
        self.store().record_mentor_use(&req.problem_id, &req.mode)?;
        on_event(MentorStreamEvent::Done { message });
        Ok(())
    }

    // --- questions written by AI --------------------------------------------------------

    fn category_choices(&self) -> Result<Vec<(String, String)>> {
        Ok(self.store().list_categories()?.into_iter().map(|c| (c.id, c.name)).collect())
    }

    /// Asks the question writer and returns its reply text.
    async fn write(&self, cfg: &ProviderConfig, turns: &[Turn]) -> Result<String> {
        let req = ChatRequest { system: prompts::WRITER_SYSTEM, turns, max_tokens: writer_tokens(cfg.wire) };
        let outcome = self.ai.chat(cfg, &req, &mut |_| {}, &Cancel::new()).await?;
        if outcome.truncated {
            return Err(ServiceError::Unavailable(
                "The AI's answer was cut off at its length limit. Try fewer questions at a time.".into(),
            ));
        }
        Ok(outcome.text)
    }

    /// Runs a draft's reference on its tests and keeps only what checks out.
    fn verify_draft(
        &self,
        draft: QuestionDraft,
        origin: ProblemOrigin,
        fallback_category: &str,
    ) -> std::result::Result<GeneratedQuestion, String> {
        let known: Vec<String> =
            self.category_choices().map_err(|e| e.to_string())?.into_iter().map(|(id, _)| id).collect();
        let mut q = draft.into_input(origin, &known);
        if q.category_ids.is_empty() {
            q.category_ids.push(fallback_category.to_string());
        }
        let reference = q.reference.clone().ok_or("the question has no referenceJs solution")?;
        let total = q.tests.len();
        // Inputs must fit the signature before anything runs.
        let sig = q.signature.clone();
        q.tests.retain(|t| {
            t.input.len() == sig.params.len() && sig.params.iter().zip(&t.input).all(|(p, v)| fits(p.ty, v))
        });

        let req = VerifyRequest {
            signature: sig,
            comparator: q.comparator,
            in_place_arg: q.in_place_arg,
            tests: q
                .tests
                .iter()
                .map(|t| VerifyTest { input: t.input.clone(), expected: t.expected.clone() })
                .collect(),
            language: Language::Javascript,
            code: reference.code,
        };
        let result = self.verify_reference(&req, Trust::Untrusted).map_err(|e| e.to_string())?;
        if !result.executed {
            return Err(format!(
                "its referenceJs didn't run: {}",
                result.note.unwrap_or_else(|| "unknown error".into())
            ));
        }
        let answer = answer_type(&q);
        let mut kept = Vec::new();
        for (test, case) in q.tests.into_iter().zip(result.results) {
            if case.error.is_none() && answer.is_none_or(|ty| fits(ty, &case.actual)) {
                kept.push(codegym_core::TestCase { expected: case.actual, ..test });
            }
        }
        q.tests = kept;
        if !q.tests.is_empty() && q.tests.iter().all(|t| t.hidden) {
            q.tests[0].hidden = false;
        }
        validate_question(&q).map_err(|e| format!("after checking its tests: {e}"))?;
        let verified = q.tests.len();
        Ok(GeneratedQuestion { question: q, verified_tests: verified, dropped_tests: total - verified })
    }

    /// Turns pasted problem text into a verified question (not saved yet).
    pub async fn import_problem(&self, text: &str) -> Result<GeneratedQuestion> {
        let (_, cfg) = self.active_provider()?;
        let categories = self.category_choices()?;
        let fallback = categories.first().map(|c| c.0.clone()).unwrap_or_default();
        let mut turns = vec![Turn::user(prompts::import_prompt(text, &categories))];
        let mut last_error = String::new();
        for _attempt in 0..2 {
            let reply = self.write(&cfg, &turns).await?;
            let outcome = draft::parse_one(&reply).and_then(|d| {
                tokio::task::block_in_place(|| self.verify_draft(d, ProblemOrigin::AiImported, &fallback))
            });
            match outcome {
                Ok(q) => return Ok(q),
                Err(e) => {
                    last_error = e.clone();
                    turns.push(Turn::assistant(reply));
                    turns.push(Turn::user(prompts::repair_prompt(&e)));
                }
            }
        }
        Err(ServiceError::Invalid(format!("The AI's question couldn't be verified: {last_error}")))
    }

    /// Writes new questions on a topic, verifies each, and returns the ones that pass.
    pub async fn generate_questions(
        &self,
        req: &GenerateRequest,
        on_progress: &mut (dyn FnMut(GenerateProgress) + Send),
    ) -> Result<Vec<GeneratedQuestion>> {
        if req.topic.trim().len() < 2 || !(1..=MAX_GENERATE).contains(&req.count) {
            return Err(ServiceError::Invalid(format!("Pick a topic and 1–{MAX_GENERATE} questions.")));
        }
        let (_, cfg) = self.active_provider()?;
        let categories = self.category_choices()?;
        let topic_category =
            categories.iter().find(|(_, name)| name.eq_ignore_ascii_case(req.topic.trim())).map(|c| c.0.clone());
        let fallback = topic_category.clone().or_else(|| categories.first().map(|c| c.0.clone())).unwrap_or_default();
        let existing: Vec<String> = self
            .store()
            .list_bank_questions()?
            .into_iter()
            .filter(|q| topic_category.as_ref().is_none_or(|c| q.summary.categories.iter().any(|r| &r.id == c)))
            .map(|q| q.summary.title)
            .take(80)
            .collect();
        let prompt = prompts::generate_prompt(
            req.topic.trim(),
            req.difficulty.as_str(),
            req.count,
            &req.notes,
            &existing,
            &categories,
        );

        let mut turns = vec![Turn::user(prompt)];
        let mut last_error = String::new();
        for _attempt in 0..2 {
            on_progress(GenerateProgress::Writing);
            let reply = self.write(&cfg, &turns).await?;
            on_progress(GenerateProgress::Testing);
            let drafts = match draft::parse_many(&reply) {
                Ok(d) => d,
                Err(e) => {
                    last_error = e.clone();
                    turns.push(Turn::assistant(reply));
                    turns.push(Turn::user(prompts::repair_prompt(&e)));
                    continue;
                }
            };
            on_progress(GenerateProgress::Verifying);
            let mut good = Vec::new();
            let mut problems = Vec::new();
            for (i, d) in drafts.into_iter().take(req.count).enumerate() {
                let title = d.title.clone();
                let mut q =
                    match tokio::task::block_in_place(|| self.verify_draft(d, ProblemOrigin::AiGenerated, &fallback)) {
                        Ok(q) => q,
                        Err(e) => {
                            problems.push(format!("question {} (\"{title}\"): {e}", i + 1));
                            continue;
                        }
                    };
                q.question.difficulty = req.difficulty;
                good.push(q);
            }
            if !good.is_empty() {
                on_progress(GenerateProgress::Done);
                return Ok(good);
            }
            last_error = problems.join("; ");
            turns.push(Turn::assistant(reply));
            turns.push(Turn::user(prompts::repair_prompt(&last_error)));
        }
        Err(ServiceError::Invalid(format!("None of the AI's questions could be verified: {last_error}")))
    }
}
