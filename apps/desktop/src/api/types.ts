import type {
  AiProfile,
  AiProfileForm,
  AppSettings,
  BankQuestion,
  Category,
  CategoryForm,
  ChatMessage,
  ConnectionTest,
  Dashboard,
  Draft,
  GeneratedQuestion,
  GenerateProgress,
  GenerateRequest,
  Language,
  MentorMode,
  MentorStreamEvent,
  PlanDetail,
  PlanForm,
  PlanSummary,
  Problem,
  ProblemSummary,
  QuestionInput,
  QuestionRecord,
  ResetProgressRequest,
  RunRequest,
  RunResult,
  RuntimeInfo,
  Stats,
  Submission,
  SubmitResult,
  Comparator,
  TestCase,
  VerifyResult,
  Signature,
} from "@/schemas";

export interface VerifyRequest {
  signature: Signature;
  comparator: Comparator;
  inPlaceArg: number | null;
  tests: Pick<TestCase, "input" | "expected">[];
  language: Language;
  code: string;
}

export interface MentorRequest {
  problemId: string;
  language: Language;
  mode: MentorMode;
  message: string;
  code: string;
  lastRun: RunResult | null;
}

export interface DataInfo {
  dbPath: string;
  builtinProblems: number;
  customProblems: number;
  bankVersion: string;
}

export type ActivityEvent =
  | { type: "problem_opened"; problemId: string }
  | { type: "session_heartbeat"; problemId: string; activeSeconds: number }
  | { type: "problem_closed"; problemId: string };

/**
 * Everything the UI can ask the backend. The Tauri implementation calls Rust commands;
 * the mock implementation powers the browser prototype and tests.
 */
export interface CodegymApi {
  listProblems(): Promise<ProblemSummary[]>;
  getProblem(id: string): Promise<Problem>;
  getStats(): Promise<Stats>;
  getDashboard(): Promise<Dashboard>;

  getDraft(problemId: string, language: Language): Promise<Draft | null>;
  saveDraft(problemId: string, language: Language, code: string): Promise<Draft>;
  starterCode(problemId: string, language: Language): Promise<string>;

  runCode(req: RunRequest): Promise<RunResult>;
  submitCode(req: RunRequest): Promise<SubmitResult>;
  listSubmissions(problemId: string): Promise<Submission[]>;
  recordActivity(event: ActivityEvent): Promise<void>;

  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<AppSettings>;
  detectRuntimes(): Promise<RuntimeInfo[]>;
  dataInfo(): Promise<DataInfo>;
  /** Deletes all progress, submissions, drafts, chats and activity records. Settings and AI profiles stay. */
  resetProgress(req: ResetProgressRequest): Promise<void>;

  listAiProfiles(): Promise<AiProfile[]>;
  saveAiProfile(form: AiProfileForm): Promise<AiProfile>;
  deleteAiProfile(id: string): Promise<void>;
  setActiveAiProfile(id: string): Promise<void>;
  listModels(form: AiProfileForm): Promise<string[]>;
  testConnection(form: AiProfileForm): Promise<ConnectionTest>;

  listChat(problemId: string): Promise<ChatMessage[]>;
  clearChat(problemId: string): Promise<void>;
  sendMentorMessage(
    req: MentorRequest,
    onEvent: (event: MentorStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<void>;

  /** Turns pasted text into a question preview (not saved yet). */
  importProblem(text: string): Promise<GeneratedQuestion>;

  // Question Bank
  listBankQuestions(): Promise<BankQuestion[]>;
  getQuestion(id: string): Promise<QuestionRecord>;
  createQuestion(input: QuestionInput): Promise<QuestionRecord>;
  updateQuestion(id: string, input: QuestionInput): Promise<QuestionRecord>;
  /** Deletes your own questions with their submissions and drafts. Built-ins are refused. */
  deleteQuestions(ids: string[]): Promise<void>;
  setHidden(ids: string[], hidden: boolean): Promise<void>;
  verifyReference(req: VerifyRequest): Promise<VerifyResult>;
  generateQuestions(
    req: GenerateRequest,
    onProgress: (step: GenerateProgress) => void,
  ): Promise<GeneratedQuestion[]>;

  // Categories
  listCategories(): Promise<Category[]>;
  saveCategory(form: CategoryForm): Promise<Category>;
  /** Removes the tag only; questions are kept. Built-in categories are refused. */
  deleteCategory(id: string): Promise<void>;
  setQuestionCategories(ids: string[], add: string[], remove: string[]): Promise<void>;

  // Study plans
  listPlans(): Promise<PlanSummary[]>;
  getPlan(id: string): Promise<PlanDetail>;
  savePlan(form: PlanForm): Promise<PlanSummary>;
  duplicatePlan(id: string): Promise<PlanSummary>;
  deletePlan(id: string): Promise<void>;
  setPlanItems(id: string, problemIds: string[]): Promise<void>;
}
