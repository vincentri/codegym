import { Channel, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
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
  packExportSchema,
  packImportSchema,
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

/** Calls a Rust command and checks its answer against the schema the UI relies on. */
async function call<T>(
  command: string,
  schema: z.ZodType<T>,
  args?: Record<string, unknown>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await invoke(command, args);
  } catch (e) {
    const parsed = serviceErrorSchema.safeParse(e);
    if (parsed.success) throw new BackendError(parsed.data.kind, parsed.data.message);
    throw new BackendError("internal", typeof e === "string" ? e : String(e));
  }
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

/** A channel that forwards only messages matching `schema` (Rust streams over these). */
function typedChannel<T>(schema: z.ZodType<T>, onMessage: (value: T) => void): Channel<unknown> {
  const channel = new Channel<unknown>();
  channel.onmessage = (raw) => {
    const parsed = schema.safeParse(raw);
    if (parsed.success) onMessage(parsed.data);
  };
  return channel;
}

const PACK_FILTERS = [{ name: "CodeGym problem pack", extensions: ["json"] }];

export function createTauriApi(): CodegymApi {
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
    exportProblemPack: async () => {
      const path = await save({ defaultPath: "my-problems.codegym.json", filters: PACK_FILTERS });
      return path ? call("export_problem_pack", packExportSchema, { path }) : null;
    },
    importProblemPack: async () => {
      const path = await open({ multiple: false, directory: false, filters: PACK_FILTERS });
      return typeof path === "string"
        ? call("import_problem_pack", packImportSchema, { path })
        : null;
    },
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
      const requestId = crypto.randomUUID();
      const stop = () => void invoke("cancel_ai", { requestId }).catch(() => undefined);
      signal.addEventListener("abort", stop, { once: true });
      try {
        await call("send_mentor_message", done, {
          req,
          requestId,
          onEvent: typedChannel(mentorStreamEventSchema, onEvent),
        });
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
      call("generate_questions", z.array(generatedQuestionSchema), {
        req,
        onProgress: typedChannel(generateProgressSchema, onProgress),
      }),

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
