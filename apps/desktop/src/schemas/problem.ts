import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const paramTypeSchema = z.enum([
  "int",
  "float",
  "bool",
  "string",
  "int[]",
  "float[]",
  "string[]",
  "bool[]",
  "int[][]",
  "string[][]",
  "char[][]",
  "ListNode",
  "ListNode[]",
  "TreeNode",
  "void",
]);
export type ParamType = z.infer<typeof paramTypeSchema>;

export const signatureSchema = z.object({
  functionName: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Must be a valid identifier"),
  params: z.array(
    z.object({
      name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Must be a valid identifier"),
      type: paramTypeSchema,
    }),
  ),
  returns: paramTypeSchema,
});
export type Signature = z.infer<typeof signatureSchema>;

export const comparatorSchema = z.enum(["exact", "unordered", "unorderedNested", "float"]);
export type Comparator = z.infer<typeof comparatorSchema>;

export const testCaseSchema = z.object({
  input: z.array(z.unknown()),
  expected: z.unknown(),
  hidden: z.boolean().default(false),
});
export type TestCase = z.infer<typeof testCaseSchema>;

export const problemSourceSchema = z.enum(["builtin", "custom"]);

export const problemSummarySchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  difficulty: difficultySchema,
  topics: z.array(z.string()),
  source: problemSourceSchema,
  status: z.enum(["todo", "attempted", "solved"]),
});
export type ProblemSummary = z.infer<typeof problemSummarySchema>;

export const problemSchema = problemSummarySchema.extend({
  descriptionMd: z.string(),
  constraints: z.array(z.string()),
  signature: signatureSchema,
  comparator: comparatorSchema,
  inPlaceArg: z.number().int().nonnegative().nullable(),
  /** Only the visible (non-hidden) examples are sent to the UI. */
  examples: z.array(testCaseSchema),
  hiddenTestCount: z.number().int().nonnegative(),
});
export type Problem = z.infer<typeof problemSchema>;

export const statsSchema = z.object({
  solved: z.number().int(),
  total: z.number().int(),
  byDifficulty: z.record(
    difficultySchema,
    z.object({ solved: z.number().int(), total: z.number().int() }),
  ),
  streakDays: z.number().int(),
});
export type Stats = z.infer<typeof statsSchema>;
