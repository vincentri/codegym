import { z } from "zod";
import { languageSchema } from "./language";

export const verdictSchema = z.enum([
  "accepted",
  "wrong_answer",
  "runtime_error",
  "compile_error",
  "time_limit",
  "memory_limit",
  "internal_error",
]);
export type Verdict = z.infer<typeof verdictSchema>;

export const testResultSchema = z.object({
  index: z.number().int(),
  hidden: z.boolean(),
  custom: z.boolean(),
  input: z.array(z.unknown()).nullable(),
  expected: z.unknown().nullable(),
  actual: z.unknown().nullable(),
  passed: z.boolean().nullable(),
  stdout: z.string(),
  error: z.string().nullable(),
  timeMs: z.number(),
});
export type TestResult = z.infer<typeof testResultSchema>;

export const runResultSchema = z.object({
  verdict: verdictSchema,
  passed: z.number().int(),
  total: z.number().int(),
  results: z.array(testResultSchema),
  compileOutput: z.string().nullable(),
  totalTimeMs: z.number(),
});
export type RunResult = z.infer<typeof runResultSchema>;

export const runRequestSchema = z.object({
  problemId: z.string(),
  language: languageSchema,
  code: z.string(),
  customInputs: z.array(z.array(z.unknown())),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

export const submissionSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  language: languageSchema,
  verdict: verdictSchema,
  passed: z.number().int(),
  total: z.number().int(),
  runtimeMs: z.number().nullable(),
  createdAt: z.string(),
  code: z.string(),
});
export type Submission = z.infer<typeof submissionSchema>;

export const submitResultSchema = z.object({
  run: runResultSchema,
  submission: submissionSchema,
  firstSolve: z.boolean(),
});
export type SubmitResult = z.infer<typeof submitResultSchema>;

export const draftSchema = z.object({
  problemId: z.string(),
  language: languageSchema,
  code: z.string(),
  updatedAt: z.string(),
});
export type Draft = z.infer<typeof draftSchema>;
