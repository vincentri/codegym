// The Rust backend's API, shared by the desktop app (Tauri commands, `tauri.ts`) and the
// browser build served by Docker (HTTP, `http.ts`). Only how a command reaches Rust differs;
// every reply is checked against the schema the UI relies on.

import { z } from "zod";
import {
  aiProfileSchema,
  appSettingsSchema,
  bankQuestionSchema,
  categorySchema,
  chatMessageSchema,
  connectionTestSchema,
  dashboardSchema,
  draftSchema,
  generatedQuestionSchema,
  generateProgressSchema,
  mentorStreamEventSchema,
  planDetailSchema,
  planSummarySchema,
  problemSchema,
  problemSummarySchema,
  questionRecordSchema,
  runResultSchema,
  runtimeInfoSchema,
  statsSchema,
  submissionSchema,
  submitResultSchema,
  verifyResultSchema,
} from "@/schemas";
import type { PackExport, PackImport } from "@/schemas";
import type { CodegymApi } from "./types";

export const dataInfoSchema = z.object({
  dbPath: z.string(),
  builtinProblems: z.number().int(),
  customProblems: z.number().int(),
  bankVersion: z.string(),
});

/** How the Rust side reports errors (`ServiceError`). */
const serviceErrorSchema = z.object({ kind: z.string(), message: z.string() });

export class BackendError extends Error {
  constructor(
    readonly kind: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/** Calls a command and checks its answer against `schema`. */
export type Call = <T>(
  command: string,
  schema: z.ZodType<T>,
  args?: Record<string, unknown>,
) => Promise<T>;

/** How commands reach the Rust backend. */
export interface Transport {
  /** Runs a command; rejects with the backend's error as sent. */
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
  /**
   * Runs a command that streams events: each one goes to `onEvent`, and the promise resolves with
   * the final result. `channelArg` names the argument the desktop app passes its channel in.
   */
  stream(
    command: string,
    args: Record<string, unknown>,
    channelArg: string,
    onEvent: (raw: unknown) => void,
  ): Promise<unknown>;
  /** Packs are files: native dialogs in the desktop app, downloads and uploads in a browser. */
  exportProblemPack(call: Call): Promise<PackExport | null>;
  importProblemPack(call: Call): Promise<PackImport | null>;
}

function toBackendError(e: unknown): BackendError {
  if (e instanceof BackendError) return e;
  const parsed = serviceErrorSchema.safeParse(e);
  if (parsed.success) return new BackendError(parsed.data.kind, parsed.data.message);
  return new BackendError("internal", typeof e === "string" ? e : String(e));
}

function check<T>(command: string, schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BackendError(
      "internal",
      `Unexpected reply from ${command}: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

const done = z.null();
const nothing = async (p: Promise<null>) => {
  await p;
};

/** Passes on only the events that match `schema`. */
function typed<T>(schema: z.ZodType<T>, onEvent: (value: T) => void) {
  return (raw: unknown) => {
    const parsed = schema.safeParse(raw);
    if (parsed.success) onEvent(parsed.data);
  };
}

export function createBackendApi(transport: Transport): CodegymApi {
  const call: Call = async (command, schema, args) => {
    let raw: unknown;
    try {
      raw = await transport.invoke(command, args);
    } catch (e) {
      throw toBackendError(e);
    }
    return check(command, schema, raw);
  };
  const stream = async <T>(
    command: string,
    schema: z.ZodType<T>,
    args: Record<string, unknown>,
    channelArg: string,
    onEvent: (raw: unknown) => void,
  ): Promise<T> => {
    let raw: unknown;
    try {
      raw = await transport.stream(command, args, channelArg, onEvent);
    } catch (e) {
      throw toBackendError(e);
    }
    return check(command, schema, raw);
  };

  return {
    listProblems: () => call("list_problems", z.array(problemSummarySchema)),
    getProblem: (id) => call("get_problem", problemSchema, { id }),
    getStats: () => call("get_stats", statsSchema),
    getDashboard: () => call("get_dashboard", dashboardSchema),

    getDraft: (problemId, language) =>
      call("get_draft", draftSchema.nullable(), { problemId, language }),
    saveDraft: (problemId, language, code) =>
      call("save_draft", draftSchema, { problemId, language, code }),
    starterCode: (problemId, language) => call("starter_code", z.string(), { problemId, language }),

    runCode: (req) => call("run_code", runResultSchema, { req }),
    submitCode: (req) => call("submit_code", submitResultSchema, { req }),
    listSubmissions: (problemId) =>
      call("list_submissions", z.array(submissionSchema), { problemId }),
    recordActivity: (event) => nothing(call("record_activity", done, { event })),

    getSettings: () => call("get_settings", appSettingsSchema),
    updateSettings: (settings) => call("update_settings", appSettingsSchema, { settings }),
    detectRuntimes: () => call("detect_runtimes", z.array(runtimeInfoSchema)),
    dataInfo: () => call("data_info", dataInfoSchema),
    openDataFolder: () => nothing(call("open_data_folder", done)),
    exportProblemPack: () => transport.exportProblemPack(call),
    importProblemPack: () => transport.importProblemPack(call),
    resetProgress: (req) => nothing(call("reset_progress", done, { req })),

    listAiProfiles: () => call("list_ai_profiles", z.array(aiProfileSchema)),
    saveAiProfile: (form) => call("save_ai_profile", aiProfileSchema, { form }),
    deleteAiProfile: (id) => nothing(call("delete_ai_profile", done, { id })),
    setActiveAiProfile: (id) => nothing(call("set_active_ai_profile", done, { id })),
    listModels: (form) => call("list_models", z.array(z.string()), { form }),
    testConnection: (form) => call("test_connection", connectionTestSchema, { form }),

    listChat: (problemId) => call("list_chat", z.array(chatMessageSchema), { problemId }),
    clearChat: (problemId) => nothing(call("clear_chat", done, { problemId })),
    sendMentorMessage: async (req, onEvent, signal) => {
      if (signal.aborted) return;
      const requestId = crypto.randomUUID();
      const stop = () => void transport.invoke("cancel_ai", { requestId }).catch(() => undefined);
      signal.addEventListener("abort", stop, { once: true });
      try {
        await stream(
          "send_mentor_message",
          done,
          { req, requestId },
          "onEvent",
          typed(mentorStreamEventSchema, onEvent),
        );
      } finally {
        signal.removeEventListener("abort", stop);
      }
    },
    importProblem: (text) => call("import_problem", generatedQuestionSchema, { text }),

    listBankQuestions: () => call("list_bank_questions", z.array(bankQuestionSchema)),
    getQuestion: (id) => call("get_question", questionRecordSchema, { id }),
    createQuestion: (input) => call("create_question", questionRecordSchema, { input }),
    updateQuestion: (id, input) => call("update_question", questionRecordSchema, { id, input }),
    deleteQuestions: (ids) => nothing(call("delete_questions", done, { ids })),
    setHidden: (ids, hidden) => nothing(call("set_hidden", done, { ids, hidden })),
    verifyReference: (req) => call("verify_reference", verifyResultSchema, { req }),
    generateQuestions: (req, onProgress) =>
      stream(
        "generate_questions",
        z.array(generatedQuestionSchema),
        { req },
        "onProgress",
        typed(generateProgressSchema, onProgress),
      ),

    listCategories: () => call("list_categories", z.array(categorySchema)),
    saveCategory: (form) => call("save_category", categorySchema, { form }),
    deleteCategory: (id) => nothing(call("delete_category", done, { id })),
    setQuestionCategories: (ids, add, remove) =>
      nothing(call("set_question_categories", done, { ids, add, remove })),

    listPlans: () => call("list_plans", z.array(planSummarySchema)),
    getPlan: (id) => call("get_plan", planDetailSchema, { id }),
    savePlan: (form) => call("save_plan", planSummarySchema, { form }),
    duplicatePlan: (id) => call("duplicate_plan", planSummarySchema, { id }),
    deletePlan: (id) => nothing(call("delete_plan", done, { id })),
    setPlanItems: (id, problemIds) => nothing(call("set_plan_items", done, { id, problemIds })),
  };
}
