import type {
  AiProfile,
  AiProfileForm,
  AppSettings,
  ChatMessage,
  ConnectionTest,
  Dashboard,
  Draft,
  Language,
  MentorMode,
  MentorStreamEvent,
  Problem,
  ProblemSummary,
  ResetProgressRequest,
  RunRequest,
  RunResult,
  RuntimeInfo,
  Stats,
  Submission,
  SubmitResult,
} from "@/schemas";

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

  importProblem(text: string): Promise<Problem>;
}
