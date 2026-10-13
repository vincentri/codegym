//! Data types shared by the store, runner and app. Field names serialize to camelCase so they
//! match the Zod schemas in `apps/desktop/src/schemas` exactly; the frontend parses every
//! response with those schemas.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Difficulty {
    Easy,
    Medium,
    Hard,
}

impl Difficulty {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Easy => "easy",
            Self::Medium => "medium",
            Self::Hard => "hard",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParamType {
    #[serde(rename = "int")]
    Int,
    #[serde(rename = "float")]
    Float,
    #[serde(rename = "bool")]
    Bool,
    #[serde(rename = "string")]
    String,
    #[serde(rename = "int[]")]
    IntArray,
    #[serde(rename = "float[]")]
    FloatArray,
    #[serde(rename = "string[]")]
    StringArray,
    #[serde(rename = "bool[]")]
    BoolArray,
    #[serde(rename = "int[][]")]
    IntMatrix,
    #[serde(rename = "string[][]")]
    StringMatrix,
    #[serde(rename = "char[][]")]
    CharMatrix,
    #[serde(rename = "ListNode")]
    ListNode,
    #[serde(rename = "ListNode[]")]
    ListNodeArray,
    #[serde(rename = "TreeNode")]
    TreeNode,
    #[serde(rename = "void")]
    Void,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Param {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: ParamType,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Signature {
    pub function_name: String,
    pub params: Vec<Param>,
    pub returns: ParamType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Comparator {
    Exact,
    Unordered,
    UnorderedNested,
    Float,
}

impl Comparator {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exact => "exact",
            Self::Unordered => "unordered",
            Self::UnorderedNested => "unorderedNested",
            Self::Float => "float",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TestCase {
    pub input: Vec<Value>,
    pub expected: Value,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProblemOrigin {
    Builtin,
    Manual,
    AiImported,
    AiGenerated,
}

impl ProblemOrigin {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Builtin => "builtin",
            Self::Manual => "manual",
            Self::AiImported => "ai_imported",
            Self::AiGenerated => "ai_generated",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Javascript,
    Python,
    Go,
}

impl Language {
    pub const ALL: [Language; 3] = [Language::Javascript, Language::Python, Language::Go];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Javascript => "javascript",
            Self::Python => "python",
            Self::Go => "go",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProblemStatus {
    Todo,
    Attempted,
    Solved,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CategoryRef {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemSummary {
    pub id: String,
    pub number: i64,
    pub title: String,
    pub difficulty: Difficulty,
    pub categories: Vec<CategoryRef>,
    pub origin: ProblemOrigin,
    pub hidden: bool,
    pub status: ProblemStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Problem {
    #[serde(flatten)]
    pub summary: ProblemSummary,
    pub description_md: String,
    pub constraints: Vec<String>,
    pub signature: Signature,
    pub comparator: Comparator,
    pub in_place_arg: Option<usize>,
    pub examples: Vec<TestCase>,
    pub hidden_test_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceSolution {
    pub language: Language,
    pub code: String,
}

/// A full question as written by its author, including hidden tests.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionInput {
    pub title: String,
    pub difficulty: Difficulty,
    pub category_ids: Vec<String>,
    pub description_md: String,
    pub constraints: Vec<String>,
    pub hints: Vec<String>,
    pub signature: Signature,
    pub comparator: Comparator,
    pub in_place_arg: Option<usize>,
    pub tests: Vec<TestCase>,
    pub reference: Option<ReferenceSolution>,
    pub origin: ProblemOrigin,
    pub forked_from: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionRecord {
    pub id: String,
    #[serde(flatten)]
    pub input: QuestionInput,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankQuestion {
    #[serde(flatten)]
    pub summary: ProblemSummary,
    pub test_count: usize,
    pub verified: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DifficultyCount {
    pub solved: i64,
    pub total: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ByDifficulty {
    pub easy: DifficultyCount,
    pub medium: DifficultyCount,
    pub hard: DifficultyCount,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub solved: i64,
    pub total: i64,
    pub by_difficulty: ByDifficulty,
    pub streak_days: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Accepted,
    WrongAnswer,
    RuntimeError,
    CompileError,
    TimeLimit,
    MemoryLimit,
    InternalError,
}

impl Verdict {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Accepted => "accepted",
            Self::WrongAnswer => "wrong_answer",
            Self::RuntimeError => "runtime_error",
            Self::CompileError => "compile_error",
            Self::TimeLimit => "time_limit",
            Self::MemoryLimit => "memory_limit",
            Self::InternalError => "internal_error",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "accepted" => Self::Accepted,
            "wrong_answer" => Self::WrongAnswer,
            "runtime_error" => Self::RuntimeError,
            "compile_error" => Self::CompileError,
            "time_limit" => Self::TimeLimit,
            "memory_limit" => Self::MemoryLimit,
            _ => Self::InternalError,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub index: usize,
    pub hidden: bool,
    pub custom: bool,
    pub input: Option<Vec<Value>>,
    pub expected: Option<Value>,
    pub actual: Option<Value>,
    pub passed: Option<bool>,
    pub stdout: String,
    pub error: Option<String>,
    pub time_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub verdict: Verdict,
    pub passed: usize,
    pub total: usize,
    pub results: Vec<TestResult>,
    pub compile_output: Option<String>,
    pub total_time_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRequest {
    pub problem_id: String,
    pub language: Language,
    pub code: String,
    #[serde(default)]
    pub custom_inputs: Vec<Vec<Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Submission {
    pub id: String,
    pub problem_id: String,
    pub language: Language,
    pub verdict: Verdict,
    pub passed: i64,
    pub total: i64,
    pub runtime_ms: Option<f64>,
    pub created_at: String,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResult {
    pub run: RunResult,
    pub submission: Submission,
    pub first_solve: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub problem_id: String,
    pub language: Language,
    pub code: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub default_language: Language,
    pub editor_font_size: i64,
    pub editor_tab_size: i64,
    pub autosave_seconds: i64,
    pub run_timeout_seconds: i64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            default_language: Language::Python,
            editor_font_size: 14,
            editor_tab_size: 4,
            autosave_seconds: 5,
            run_timeout_seconds: 10,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub language: Language,
    pub engine: String,
    pub version: Option<String>,
    pub available: bool,
    pub bundled: bool,
    pub install_hint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataInfo {
    pub db_path: String,
    pub builtin_problems: i64,
    pub custom_problems: i64,
    pub bank_version: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub description: String,
    pub builtin: bool,
    pub question_count: i64,
    pub solved_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryForm {
    pub id: Option<String>,
    pub name: String,
    pub color: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub builtin: bool,
    pub solved: i64,
    pub total: i64,
    pub next: Option<ProblemSummary>,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDetail {
    #[serde(flatten)]
    pub summary: PlanSummary,
    pub items: Vec<ProblemSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanForm {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinueProblem {
    pub problem: ProblemSummary,
    pub attempts: i64,
    pub language: Language,
    pub last_active_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSubmission {
    #[serde(flatten)]
    pub submission: Submission,
    pub problem_title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Suggestion {
    pub topic: String,
    pub solved: i64,
    pub total: i64,
    pub problems: Vec<ProblemSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    pub continue_problem: Option<ContinueProblem>,
    pub plan: Option<PlanSummary>,
    pub recent_submissions: Vec<RecentSubmission>,
    pub suggestion: Option<Suggestion>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActivityEvent {
    ProblemOpened {
        #[serde(rename = "problemId")]
        problem_id: String,
    },
    SessionHeartbeat {
        #[serde(rename = "problemId")]
        problem_id: String,
        #[serde(rename = "activeSeconds")]
        active_seconds: i64,
    },
    ProblemClosed {
        #[serde(rename = "problemId")]
        problem_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyTest {
    pub input: Vec<Value>,
    pub expected: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyRequest {
    pub signature: Signature,
    pub comparator: Comparator,
    pub in_place_arg: Option<usize>,
    pub tests: Vec<VerifyTest>,
    pub language: Language,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerifyCase {
    pub index: usize,
    pub actual: Value,
    pub passed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VerifyResult {
    pub results: Vec<VerifyCase>,
    pub executed: bool,
    pub note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub problem_id: String,
    pub role: String,
    pub mode: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProfile {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub effort: String,
    pub mentor_style: String,
    pub has_api_key: bool,
    pub is_active: bool,
}

/// Body of Settings → AI Mentor's form. The API key never comes back out of the backend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProfileForm {
    pub id: Option<String>,
    pub provider: String,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub api_key: String,
    pub has_stored_key: bool,
    pub effort: String,
    pub mentor_style: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetProgressRequest {
    pub include_custom_problems: bool,
}

// --- AI --------------------------------------------------------------------------

/// A question for the mentor about the problem being solved (`MentorRequest` in api/types.ts).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MentorRequest {
    pub problem_id: String,
    pub language: Language,
    /// chat, hint, explain, review, debug, complexity, approach or solution.
    pub mode: String,
    pub message: String,
    pub code: String,
    pub last_run: Option<RunResult>,
}

/// Streamed to the mentor panel while a reply is written.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MentorStreamEvent {
    Delta {
        text: String,
    },
    /// The text so far was withdrawn (a model declined and another took over); start again.
    Reset,
    Done {
        message: ChatMessage,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTest {
    pub ok: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub topic: String,
    pub difficulty: Difficulty,
    pub count: usize,
    pub notes: String,
    pub plan_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GenerateProgress {
    Writing,
    Testing,
    Verifying,
    Done,
}

/// An AI-written question after its reference solution was run on its tests (not saved yet).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedQuestion {
    pub question: QuestionInput,
    pub verified_tests: usize,
    pub dropped_tests: usize,
}
