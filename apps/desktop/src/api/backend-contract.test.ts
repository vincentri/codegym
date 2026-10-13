import { describe, expect, it } from "vite-plus/test";
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
  languageSchema,
  mentorStreamEventSchema,
  packExportSchema,
  packImportSchema,
  planDetailSchema,
  planSummarySchema,
  problemPackSchema,
  problemSchema,
  problemSummarySchema,
  questionRecordSchema,
  runResultSchema,
  signatureSchema,
  runtimeInfoSchema,
  statsSchema,
  submissionSchema,
  submitResultSchema,
  verifyResultSchema,
} from "@/schemas";
import { starterCode } from "@/lib/starter-code";
import fixture from "./backend-contract.json";
import { dataInfoSchema } from "./tauri";

// Real responses recorded from the Rust backend (crates/service `contract_fixture_is_up_to_date`).
// If Rust and the Zod schemas drift apart, the desktop app would reject replies at runtime; this
// catches it here instead.
const starterCase = z.object({
  signature: signatureSchema,
  inPlaceArg: z.number().int().nullable(),
  code: z.record(languageSchema, z.string()),
});

const contract: Record<keyof typeof fixture, z.ZodType> = {
  problemPack: problemPackSchema,
  exportProblemPack: packExportSchema,
  importProblemPack: packImportSchema,
  starterCode: z.array(starterCase),
  mentorEvents: z.array(mentorStreamEventSchema),
  importProblem: generatedQuestionSchema,
  generateQuestions: z.array(generatedQuestionSchema),
  testConnection: connectionTestSchema,
  listModels: z.array(z.string()),
  listProblems: z.array(problemSummarySchema),
  getProblem: problemSchema,
  getStats: statsSchema,
  getDashboard: dashboardSchema,
  getDraft: draftSchema.nullable(),
  runCode: z.array(runResultSchema),
  submitCode: submitResultSchema,
  listSubmissions: z.array(submissionSchema),
  getSettings: appSettingsSchema,
  detectRuntimes: z.array(runtimeInfoSchema),
  dataInfo: dataInfoSchema,
  listAiProfiles: z.array(aiProfileSchema),
  listChat: z.array(chatMessageSchema),
  listBankQuestions: z.array(bankQuestionSchema),
  getQuestion: questionRecordSchema,
  verifyReference: verifyResultSchema,
  listCategories: z.array(categorySchema),
  saveCategory: categorySchema,
  listPlans: z.array(planSummarySchema),
  getPlan: planDetailSchema,
};

describe("backend contract", () => {
  for (const [name, schema] of Object.entries(contract)) {
    it(`${name} matches its schema`, () => {
      const result = schema.safeParse(fixture[name as keyof typeof fixture]);
      expect(result.success ? "ok" : z.prettifyError(result.error)).toBe("ok");
    });
  }

  it("starter code matches the backend in every language", () => {
    for (const c of z.array(starterCase).parse(fixture.starterCode)) {
      for (const [language, code] of Object.entries(c.code)) {
        const lang = languageSchema.parse(language);
        expect(
          starterCode(c.signature, lang, c.inPlaceArg),
          `${c.signature.functionName} in ${lang}`,
        ).toBe(code);
      }
    }
  });

  it("covers the interesting cases", () => {
    expect(fixture.runCode.map((r) => r.verdict)).toEqual([
      "accepted",
      "runtime_error",
      "compile_error",
    ]);
    expect(fixture.submitCode.firstSolve).toBe(true);
    expect(fixture.listProblems.length).toBeGreaterThanOrEqual(30);
    expect(fixture.mentorEvents.at(-1)?.type).toBe("done");
    expect(fixture.listAiProfiles[0]?.hasApiKey).toBe(true);
    expect(fixture.importProblem.verifiedTests).toBeGreaterThan(0);
    expect(fixture.problemPack.questions.length).toBeGreaterThan(0);
    expect(fixture.importProblemPack.skipped.length).toBeGreaterThan(0);
  });
});
