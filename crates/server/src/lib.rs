//! CodeGym over HTTP, for running in Docker and using it in a browser. Every `CodegymApi` method
//! (apps/desktop/src/api/types.ts) is `POST /api/<command>` with the same JSON arguments the
//! desktop app passes to its Tauri command; the UI's `api/http.ts` is the client.
//!
//! - Replies are the command's JSON result, or `{ kind, message }` with an error status.
//! - Streaming commands (mentor chat, question generation) reply with newline-delimited JSON:
//!   `{"event": …}` lines, then one `{"result": …}` or `{"error": …}` line.
//! - There is no login: the server is meant for one person on their own machine. Requests must
//!   be JSON (so other websites can't post to it without CORS permission) and name an allowed
//!   host (so a website can't reach it through DNS rebinding).

use std::collections::HashMap;
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::extract::{Path, Request, State};
use axum::http::{StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use codegym_ai::Cancel;
use codegym_core::{
    ActivityEvent, AiProfileForm, AppSettings, CategoryForm, GenerateRequest, Language, MentorRequest, PlanForm,
    QuestionInput, ResetProgressRequest, RunRequest, VerifyRequest,
};
use codegym_runner::Trust;
use codegym_service::{Result, Service, ServiceError};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::mpsc;
use tower_http::services::ServeDir;

#[derive(Clone)]
pub struct AppState {
    service: Arc<Service>,
    tasks: Arc<AiTasks>,
    allowed_hosts: Arc<Vec<String>>,
}

impl AppState {
    /// `allowed_hosts` are extra host names (beyond localhost) the server answers to.
    pub fn new(service: Arc<Service>, allowed_hosts: Vec<String>) -> Self {
        Self { service, tasks: Arc::default(), allowed_hosts: Arc::new(allowed_hosts) }
    }
}

/// The API under `/api`, and the built UI from `ui_dir` everywhere else.
pub fn app(state: AppState, ui_dir: Option<PathBuf>) -> Router {
    let api = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/send_mentor_message", post(send_mentor_message))
        .route("/generate_questions", post(generate_questions))
        .route("/cancel_ai", post(cancel_ai))
        .route("/{command}", post(command));
    let mut router = Router::new().nest("/api", api);
    if let Some(dir) = ui_dir {
        router = router.fallback_service(ServeDir::new(dir));
    }
    router.layer(middleware::from_fn_with_state(state.clone(), check_host)).with_state(state)
}

/// Rejects requests for other host names: a website that points its own domain at this machine
/// (DNS rebinding) would otherwise count as same-origin and could drive the API.
async fn check_host(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let host = req.headers().get(header::HOST).and_then(|h| h.to_str().ok()).unwrap_or("");
    let name = host_name(host);
    let allowed = matches!(name, "localhost" | "127.0.0.1" | "[::1]" | "")
        || name.ends_with(".localhost")
        || state.allowed_hosts.iter().any(|h| h.eq_ignore_ascii_case(name));
    if allowed {
        next.run(req).await
    } else {
        let message = format!(
            "This CodeGym server doesn't answer to \"{name}\". Open it at http://localhost, or add the name to \
             CODEGYM_ALLOWED_HOSTS."
        );
        error_response(StatusCode::FORBIDDEN, &ServiceError::Invalid(message))
    }
}

/// `example.com:8080` → `example.com`, `[::1]:8080` → `[::1]`.
fn host_name(host: &str) -> &str {
    if host.starts_with('[') {
        return host.find(']').map_or(host, |end| &host[..=end]);
    }
    host.rsplit_once(':').map_or(host, |(name, _)| name)
}

fn status(e: &ServiceError) -> StatusCode {
    match e {
        ServiceError::NotFound(_) => StatusCode::NOT_FOUND,
        ServiceError::Invalid(_) => StatusCode::UNPROCESSABLE_ENTITY,
        ServiceError::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
        ServiceError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn error_response(status: StatusCode, e: &ServiceError) -> Response {
    (status, Json(json!(e))).into_response()
}

fn reply(result: Result<Value>) -> Response {
    match result {
        Ok(value) => Json(value).into_response(),
        Err(e) => error_response(status(&e), &e),
    }
}

fn to_value(value: impl serde::Serialize) -> Result<Value> {
    serde_json::to_value(value).map_err(|e| ServiceError::Internal(e.to_string()))
}

fn parse<T: serde::de::DeserializeOwned>(command: &str, args: Value) -> Result<T> {
    // Commands without arguments may be sent `null`.
    let args = if args.is_null() { json!({}) } else { args };
    serde_json::from_value(args).map_err(|e| ServiceError::Invalid(format!("Bad arguments for {command}: {e}")))
}

/// Declares the commands that call one `Service` method, with the same names and arguments as
/// the desktop app's Tauri commands (apps/desktop/src-tauri/src/lib.rs).
macro_rules! commands {
    ($( fn $name:ident($($arg:ident: $ty:ty),*) => |$s:ident| $body:expr; )*) => {
        /// The blocking commands, by name. `None` when there is no such command.
        fn dispatch(service: &Service, command: &str, args: Value) -> Option<Result<Value>> {
            match command {
                $(stringify!($name) => Some((|| {
                    #[derive(Deserialize)]
                    #[serde(rename_all = "camelCase")]
                    #[allow(dead_code)]
                    struct Args { $($arg: $ty),* }
                    let Args { $($arg),* } = parse(command, args)?;
                    let $s = service;
                    to_value($body?)
                })()),)*
                _ => None,
            }
        }

        /// Every command this server answers, including the async ones.
        pub const COMMANDS: &[&str] = &[
            $(stringify!($name),)*
            "list_models", "test_connection", "import_problem",
            "send_mentor_message", "generate_questions", "cancel_ai",
        ];
    };
}

commands! {
    fn list_problems() => |s| s.list_problems();
    fn get_problem(id: String) => |s| s.get_problem(&id);
    fn get_stats() => |s| s.get_stats();
    fn get_dashboard() => |s| s.get_dashboard();

    fn get_draft(problem_id: String, language: Language) => |s| s.get_draft(&problem_id, language);
    fn save_draft(problem_id: String, language: Language, code: String) =>
        |s| s.save_draft(&problem_id, language, &code);
    fn starter_code(problem_id: String, language: Language) => |s| s.starter_code(&problem_id, language);

    fn run_code(req: RunRequest) => |s| s.run_code(&req);
    fn submit_code(req: RunRequest) => |s| s.submit_code(&req);
    fn list_submissions(problem_id: String) => |s| s.list_submissions(&problem_id);
    fn record_activity(event: ActivityEvent) => |s| s.record_activity(&event);

    fn get_settings() => |s| s.get_settings();
    fn update_settings(settings: AppSettings) => |s| s.update_settings(&settings);
    fn detect_runtimes() => |s| Ok::<_, ServiceError>(s.detect_runtimes());
    fn data_info() => |s| s.data_info();
    fn reset_progress(req: ResetProgressRequest) => |s| s.reset_progress(&req);

    fn list_ai_profiles() => |s| s.list_ai_profiles();
    fn save_ai_profile(form: AiProfileForm) => |s| s.save_ai_profile(&form);
    fn delete_ai_profile(id: String) => |s| s.delete_ai_profile(&id);
    fn set_active_ai_profile(id: String) => |s| s.set_active_ai_profile(&id);
    fn list_chat(problem_id: String) => |s| s.list_chat(&problem_id);
    fn clear_chat(problem_id: String) => |s| s.clear_chat(&problem_id);

    fn list_bank_questions() => |s| s.list_bank_questions();
    fn get_question(id: String) => |s| s.get_question(&id);
    fn create_question(input: QuestionInput) => |s| s.create_question(&input);
    fn update_question(id: String, input: QuestionInput) => |s| s.update_question(&id, &input);
    fn delete_questions(ids: Vec<String>) => |s| s.delete_questions(&ids);
    fn set_hidden(ids: Vec<String>, hidden: bool) => |s| s.set_hidden(&ids, hidden);
    fn verify_reference(req: VerifyRequest) => |s| s.verify_reference(&req, Trust::User);

    fn list_categories() => |s| s.list_categories();
    fn save_category(form: CategoryForm) => |s| s.save_category(&form);
    fn delete_category(id: String) => |s| s.delete_category(&id);
    fn set_question_categories(ids: Vec<String>, add: Vec<String>, remove: Vec<String>) =>
        |s| s.set_question_categories(&ids, &add, &remove);

    fn list_plans() => |s| s.list_plans();
    fn get_plan(id: String) => |s| s.get_plan(&id);
    fn save_plan(form: PlanForm) => |s| s.save_plan(&form);
    fn duplicate_plan(id: String) => |s| s.duplicate_plan(&id);
    fn delete_plan(id: String) => |s| s.delete_plan(&id);
    fn set_plan_items(id: String, problem_ids: Vec<String>) => |s| s.set_plan_items(&id, &problem_ids);

    // A browser has no file paths: packs travel as file contents.
    fn export_problem_pack_text() =>
        |s| s.problem_pack_text().map(|(text, questions)| json!({ "text": text, "questions": questions }));
    fn import_problem_pack_text(text: String) => |s| s.import_pack_text(&text);
    fn open_data_folder() => |_s| Err::<(), _>(ServiceError::Unavailable(
        "CodeGym is running in Docker: its data is in the codegym-data volume.".into(),
    ));
}

/// `Json` only accepts `Content-Type: application/json`, which a page on another site can't send
/// here without a CORS preflight that this server never approves.
async fn command(State(state): State<AppState>, Path(command): Path<String>, Json(args): Json<Value>) -> Response {
    let service = state.service.clone();
    match command.as_str() {
        "list_models" => reply(
            async {
                let a: FormArgs = parse(&command, args)?;
                to_value(service.list_models(&a.form).await?)
            }
            .await,
        ),
        "test_connection" => reply(
            async {
                let a: FormArgs = parse(&command, args)?;
                to_value(service.test_connection(&a.form).await?)
            }
            .await,
        ),
        "import_problem" => reply(
            async {
                let a: TextArgs = parse(&command, args)?;
                to_value(service.import_problem(&a.text).await?)
            }
            .await,
        ),
        _ => {
            let name = command.clone();
            let result = tokio::task::spawn_blocking(move || dispatch(&service, &name, args)).await;
            match result {
                Ok(Some(result)) => reply(result),
                Ok(None) => error_response(
                    StatusCode::NOT_FOUND,
                    &ServiceError::NotFound(format!("There is no command called {command}")),
                ),
                Err(e) => error_response(StatusCode::INTERNAL_SERVER_ERROR, &ServiceError::Internal(e.to_string())),
            }
        }
    }
}

#[derive(Deserialize)]
struct FormArgs {
    form: AiProfileForm,
}

#[derive(Deserialize)]
struct TextArgs {
    text: String,
}

/// Requests that can be stopped from the UI, by request id.
#[derive(Default)]
struct AiTasks(Mutex<HashMap<String, Cancel>>);

impl AiTasks {
    fn start(&self, id: &str) -> Cancel {
        let token = Cancel::new();
        self.0.lock().unwrap_or_else(|e| e.into_inner()).insert(id.to_string(), token.clone());
        token
    }

    fn finish(&self, id: &str) -> Option<Cancel> {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).remove(id)
    }
}

/// A newline-delimited JSON response fed by `lines`.
fn ndjson(lines: mpsc::UnboundedReceiver<Value>) -> Response {
    let stream = futures_util::stream::unfold(lines, |mut lines| async move {
        let line = lines.recv().await?;
        Some((Ok::<_, Infallible>(format!("{line}\n")), lines))
    });
    ([(header::CONTENT_TYPE, "application/x-ndjson"), (header::CACHE_CONTROL, "no-store")], Body::from_stream(stream))
        .into_response()
}

fn last_line<T: serde::Serialize>(result: Result<T>) -> Value {
    match result {
        Ok(value) => json!({ "result": value }),
        Err(e) => json!({ "error": e }),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MentorArgs {
    req: MentorRequest,
    request_id: String,
}

/// Streams the mentor's reply until it finishes or `cancel_ai` stops it.
async fn send_mentor_message(State(state): State<AppState>, Json(args): Json<Value>) -> Response {
    let args: MentorArgs = match parse("send_mentor_message", args) {
        Ok(a) => a,
        Err(e) => return error_response(status(&e), &e),
    };
    // Registered before the reply starts, so a Stop that follows the request can always find it.
    let cancel = state.tasks.start(&args.request_id);
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let events = tx.clone();
        let result = state
            .service
            .send_mentor_message(
                &args.req,
                &mut |event| {
                    let _ = events.send(json!({ "event": event }));
                },
                &cancel,
            )
            .await;
        state.tasks.finish(&args.request_id);
        let _ = tx.send(last_line(result));
    });
    ndjson(rx)
}

#[derive(Deserialize)]
struct GenerateArgs {
    req: GenerateRequest,
}

async fn generate_questions(State(state): State<AppState>, Json(args): Json<Value>) -> Response {
    let args: GenerateArgs = match parse("generate_questions", args) {
        Ok(a) => a,
        Err(e) => return error_response(status(&e), &e),
    };
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let events = tx.clone();
        let result = state
            .service
            .generate_questions(&args.req, &mut |step| {
                let _ = events.send(json!({ "event": step }));
            })
            .await;
        let _ = tx.send(last_line(result));
    });
    ndjson(rx)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CancelArgs {
    request_id: String,
}

async fn cancel_ai(State(state): State<AppState>, Json(args): Json<Value>) -> Response {
    reply(parse::<CancelArgs>("cancel_ai", args).map(|a| {
        if let Some(token) = state.tasks.finish(&a.request_id) {
            token.cancel();
        }
        Value::Null
    }))
}

#[cfg(test)]
mod tests;
