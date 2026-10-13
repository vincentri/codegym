//! The desktop shell: opens the database and runtimes, then exposes each `CodegymApi` method
//! (apps/desktop/src/api/types.ts) as a Tauri command. Commands run on a worker thread so a
//! long run never freezes the window.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use codegym_ai::{Cancel, KeyringStore};
use codegym_core::{
    ActivityEvent, AiProfile, AiProfileForm, AppSettings, BankQuestion, Category, CategoryForm, ChatMessage,
    ConnectionTest, Dashboard, DataInfo, Draft, GenerateProgress, GenerateRequest, GeneratedQuestion, Language,
    MentorRequest, MentorStreamEvent, PlanDetail, PlanForm, PlanSummary, Problem, ProblemSummary, QuestionInput,
    QuestionRecord, ResetProgressRequest, RunRequest, RunResult, RuntimeInfo, Stats, Submission, SubmitResult,
    VerifyRequest, VerifyResult,
};
use codegym_runner::{RunnerConfig, Trust};
use codegym_service::{Result, Service, ServiceError};
use tauri::ipc::Channel;
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;

type Svc<'a> = State<'a, Arc<Service>>;

async fn blocking<T: Send + 'static>(
    svc: &Arc<Service>,
    f: impl FnOnce(&Service) -> Result<T> + Send + 'static,
) -> Result<T> {
    let svc = svc.clone();
    tauri::async_runtime::spawn_blocking(move || f(&svc)).await.map_err(|e| ServiceError::Internal(e.to_string()))?
}

/// Declares async commands that forward to a `Service` method on a worker thread.
macro_rules! commands {
    ($( fn $name:ident($($arg:ident: $ty:ty),*) -> $ret:ty => |$s:ident| $body:expr; )*) => {
        $(
            #[tauri::command]
            async fn $name(svc: Svc<'_>, $($arg: $ty),*) -> Result<$ret> {
                blocking(&svc, move |$s| $body).await
            }
        )*
    };
}

commands! {
    fn list_problems() -> Vec<ProblemSummary> => |s| s.list_problems();
    fn get_problem(id: String) -> Problem => |s| s.get_problem(&id);
    fn get_stats() -> Stats => |s| s.get_stats();
    fn get_dashboard() -> Dashboard => |s| s.get_dashboard();

    fn get_draft(problem_id: String, language: Language) -> Option<Draft> => |s| s.get_draft(&problem_id, language);
    fn save_draft(problem_id: String, language: Language, code: String) -> Draft =>
        |s| s.save_draft(&problem_id, language, &code);
    fn starter_code(problem_id: String, language: Language) -> String => |s| s.starter_code(&problem_id, language);

    fn run_code(req: RunRequest) -> RunResult => |s| s.run_code(&req);
    fn submit_code(req: RunRequest) -> SubmitResult => |s| s.submit_code(&req);
    fn list_submissions(problem_id: String) -> Vec<Submission> => |s| s.list_submissions(&problem_id);
    fn record_activity(event: ActivityEvent) -> () => |s| s.record_activity(&event);

    fn get_settings() -> AppSettings => |s| s.get_settings();
    fn update_settings(settings: AppSettings) -> AppSettings => |s| s.update_settings(&settings);
    fn detect_runtimes() -> Vec<RuntimeInfo> => |s| Ok(s.detect_runtimes());
    fn data_info() -> DataInfo => |s| s.data_info();
    fn reset_progress(req: ResetProgressRequest) -> () => |s| s.reset_progress(&req);

    fn list_ai_profiles() -> Vec<AiProfile> => |s| s.list_ai_profiles();
    // Keychain calls can block (an unlock prompt), so they run on a worker thread too.
    fn save_ai_profile(form: AiProfileForm) -> AiProfile => |s| s.save_ai_profile(&form);
    fn delete_ai_profile(id: String) -> () => |s| s.delete_ai_profile(&id);
    fn set_active_ai_profile(id: String) -> () => |s| s.set_active_ai_profile(&id);
    fn list_chat(problem_id: String) -> Vec<ChatMessage> => |s| s.list_chat(&problem_id);
    fn clear_chat(problem_id: String) -> () => |s| s.clear_chat(&problem_id);

    fn list_bank_questions() -> Vec<BankQuestion> => |s| s.list_bank_questions();
    fn get_question(id: String) -> QuestionRecord => |s| s.get_question(&id);
    fn create_question(input: QuestionInput) -> QuestionRecord => |s| s.create_question(&input);
    fn update_question(id: String, input: QuestionInput) -> QuestionRecord => |s| s.update_question(&id, &input);
    fn delete_questions(ids: Vec<String>) -> () => |s| s.delete_questions(&ids);
    fn set_hidden(ids: Vec<String>, hidden: bool) -> () => |s| s.set_hidden(&ids, hidden);
    fn verify_reference(req: VerifyRequest) -> VerifyResult => |s| s.verify_reference(&req, Trust::User);

    fn list_categories() -> Vec<Category> => |s| s.list_categories();
    fn save_category(form: CategoryForm) -> Category => |s| s.save_category(&form);
    fn delete_category(id: String) -> () => |s| s.delete_category(&id);
    fn set_question_categories(ids: Vec<String>, add: Vec<String>, remove: Vec<String>) -> () =>
        |s| s.set_question_categories(&ids, &add, &remove);

    fn list_plans() -> Vec<PlanSummary> => |s| s.list_plans();
    fn get_plan(id: String) -> PlanDetail => |s| s.get_plan(&id);
    fn save_plan(form: PlanForm) -> PlanSummary => |s| s.save_plan(&form);
    fn duplicate_plan(id: String) -> PlanSummary => |s| s.duplicate_plan(&id);
    fn delete_plan(id: String) -> () => |s| s.delete_plan(&id);
    fn set_plan_items(id: String, problem_ids: Vec<String>) -> () => |s| s.set_plan_items(&id, &problem_ids);
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

#[tauri::command]
async fn list_models(svc: Svc<'_>, form: AiProfileForm) -> Result<Vec<String>> {
    svc.list_models(&form).await
}

#[tauri::command]
async fn test_connection(svc: Svc<'_>, form: AiProfileForm) -> Result<ConnectionTest> {
    svc.test_connection(&form).await
}

/// Streams the mentor's reply over `on_event` until it finishes or `cancel_ai` stops it.
#[tauri::command]
async fn send_mentor_message(
    svc: Svc<'_>,
    tasks: State<'_, AiTasks>,
    req: MentorRequest,
    request_id: String,
    on_event: Channel<MentorStreamEvent>,
) -> Result<()> {
    let cancel = tasks.start(&request_id);
    let result = svc
        .send_mentor_message(
            &req,
            &mut |event| {
                let _ = on_event.send(event);
            },
            &cancel,
        )
        .await;
    tasks.finish(&request_id);
    result
}

#[tauri::command]
async fn cancel_ai(tasks: State<'_, AiTasks>, request_id: String) -> Result<()> {
    if let Some(token) = tasks.finish(&request_id) {
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
async fn import_problem(svc: Svc<'_>, text: String) -> Result<GeneratedQuestion> {
    svc.import_problem(&text).await
}

#[tauri::command]
async fn generate_questions(
    svc: Svc<'_>,
    req: GenerateRequest,
    on_progress: Channel<GenerateProgress>,
) -> Result<Vec<GeneratedQuestion>> {
    svc.generate_questions(&req, &mut |step| {
        let _ = on_progress.send(step);
    })
    .await
}

/// Opens the folder holding the database in the system file manager.
#[tauri::command]
async fn open_data_folder(app: tauri::AppHandle) -> Result<()> {
    let dir = app.path().app_data_dir().map_err(|e| ServiceError::Internal(e.to_string()))?;
    app.opener().open_path(dir.display().to_string(), None::<&str>).map_err(|e| ServiceError::Internal(e.to_string()))
}

fn open_service(app: &tauri::App) -> std::result::Result<Service, Box<dyn std::error::Error>> {
    let paths = app.path();
    let db = paths.app_data_dir()?.join("codegym.db");
    let python = paths.resource_dir()?.join("python");
    let config = RunnerConfig {
        python_dir: python.join("python.wasm").is_file().then_some(python),
        cache_dir: Some(paths.app_cache_dir()?.join("wasmtime")),
        force_quickjs: false,
    };
    Ok(Service::open(&db, config, Arc::new(KeyringStore))?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let service = Arc::new(open_service(app)?);
            let warm = service.clone();
            std::thread::spawn(move || warm.warm_up());
            app.manage(service);
            app.manage(AiTasks::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_problems,
            get_problem,
            get_stats,
            get_dashboard,
            get_draft,
            save_draft,
            starter_code,
            run_code,
            submit_code,
            list_submissions,
            record_activity,
            get_settings,
            update_settings,
            detect_runtimes,
            data_info,
            reset_progress,
            list_ai_profiles,
            save_ai_profile,
            delete_ai_profile,
            set_active_ai_profile,
            list_chat,
            clear_chat,
            list_bank_questions,
            get_question,
            create_question,
            update_question,
            delete_questions,
            set_hidden,
            verify_reference,
            list_categories,
            save_category,
            delete_category,
            set_question_categories,
            list_plans,
            get_plan,
            save_plan,
            duplicate_plan,
            delete_plan,
            set_plan_items,
            open_data_folder,
            list_models,
            test_connection,
            send_mentor_message,
            cancel_ai,
            import_problem,
            generate_questions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CodeGym");
}
