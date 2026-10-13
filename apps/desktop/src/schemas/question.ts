import { z } from "zod";
import { valueSchemaFor } from "./custom-input";
import { languageSchema } from "./language";
import {
  comparatorSchema,
  difficultySchema,
  paramTypeSchema,
  problemOriginSchema,
  problemSummarySchema,
  signatureSchema,
  testCaseSchema,
  type ParamType,
} from "./problem";

// ---------------------------------------------------------------------------
// API shape: a full question as stored (all tests, including hidden ones).
// ---------------------------------------------------------------------------

export const referenceSolutionSchema = z.object({
  language: languageSchema,
  code: z.string(),
});
export type ReferenceSolution = z.infer<typeof referenceSolutionSchema>;

export const questionInputSchema = z.object({
  title: z.string(),
  difficulty: difficultySchema,
  categoryIds: z.array(z.string()),
  descriptionMd: z.string(),
  constraints: z.array(z.string()),
  hints: z.array(z.string()),
  signature: signatureSchema,
  comparator: comparatorSchema,
  inPlaceArg: z.number().int().nonnegative().nullable(),
  tests: z.array(testCaseSchema),
  reference: referenceSolutionSchema.nullable(),
  origin: problemOriginSchema.exclude(["builtin"]),
  forkedFrom: z.string().nullable(),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const questionRecordSchema = questionInputSchema.extend({
  id: z.string(),
  origin: problemOriginSchema,
});
export type QuestionRecord = z.infer<typeof questionRecordSchema>;

/** Row in the Question Bank management table. */
export const bankQuestionSchema = problemSummarySchema.extend({
  testCount: z.number().int(),
  verified: z.boolean(),
  updatedAt: z.string(),
});
export type BankQuestion = z.infer<typeof bankQuestionSchema>;

export const verifyResultSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int(),
      actual: z.unknown(),
      passed: z.boolean(),
      error: z.string().nullable(),
    }),
  ),
  /** True when the reference really ran; false when this engine can't run it here. */
  executed: z.boolean(),
  note: z.string().nullable(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;

// ---------------------------------------------------------------------------
// Editor form. Inputs are strings (JSON text) so every rule lives in Zod.
// ---------------------------------------------------------------------------

const identifier = z
  .string()
  .trim()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, digits and _ only, not starting with a digit");

const listItem = z.object({ value: z.string().trim().min(1, "Remove empty lines") });

export const editableParamTypes = paramTypeSchema.options.filter((t) => t !== "void");

export const questionFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title is too short")
      .max(120, "Keep the title under 120 characters"),
    difficulty: difficultySchema,
    categoryIds: z.array(z.string()).min(1, "Pick at least one category"),
    descriptionMd: z.string().trim().min(20, "Describe the problem in at least 20 characters"),
    constraints: z.array(listItem),
    hints: z.array(listItem),
    functionName: identifier,
    params: z
      .array(z.object({ name: identifier, type: paramTypeSchema.exclude(["void"]) }))
      .min(1, "Add at least one parameter")
      .max(6, "At most 6 parameters"),
    returns: paramTypeSchema,
    comparator: comparatorSchema,
    /** "none" or the index of the argument that is modified in place. */
    inPlaceArg: z.string(),
    tests: z
      .array(
        z.object({
          inputs: z.array(z.object({ value: z.string() })),
          expected: z.string(),
          hidden: z.boolean(),
        }),
      )
      .min(3, "Add at least 3 test cases"),
    referenceLanguage: languageSchema,
    referenceCode: z.string(),
  })
  .superRefine((form, ctx) => {
    const seen = new Set<string>();
    form.params.forEach((p, i) => {
      const name = p.name.trim();
      if (seen.has(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["params", i, "name"],
          message: "Duplicate parameter name",
        });
      }
      seen.add(name);
    });

    const inPlace = form.inPlaceArg === "none" ? null : Number(form.inPlaceArg);
    if (inPlace !== null) {
      if (form.returns !== "void") {
        ctx.addIssue({
          code: "custom",
          path: ["inPlaceArg"],
          message: 'Set the return type to "void" when the answer is modified in place',
        });
      }
      if (!(inPlace >= 0 && inPlace < form.params.length)) {
        ctx.addIssue({
          code: "custom",
          path: ["inPlaceArg"],
          message: "Pick one of the parameters",
        });
      }
    } else if (form.returns === "void") {
      ctx.addIssue({
        code: "custom",
        path: ["returns"],
        message: "A void function must modify one of its arguments in place",
      });
    }

    if (form.tests.length > 0 && form.tests.every((t) => t.hidden)) {
      ctx.addIssue({
        code: "custom",
        path: ["tests"],
        message: "Keep at least one test visible as an example",
      });
    }

    const expectedType: ParamType | null =
      inPlace !== null ? (form.params[inPlace]?.type ?? null) : form.returns;
    form.tests.forEach((test, ti) => {
      form.params.forEach((param, pi) => {
        const message = jsonIssue(test.inputs[pi]?.value ?? "", param.type);
        if (message) {
          ctx.addIssue({ code: "custom", path: ["tests", ti, "inputs", pi, "value"], message });
        }
      });
      if (expectedType) {
        const message = jsonIssue(test.expected, expectedType);
        if (message) ctx.addIssue({ code: "custom", path: ["tests", ti, "expected"], message });
      }
    });
  });
export type QuestionForm = z.infer<typeof questionFormSchema>;

/** Returns an error message when `text` is not valid JSON of the given type. */
export function jsonIssue(text: string, type: ParamType): string | null {
  if (text.trim() === "") return "Required";
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return "Not valid JSON";
  }
  const result = valueSchemaFor(type).safeParse(value);
  return result.success ? null : `Expected ${type}`;
}

export function emptyQuestionForm(): QuestionForm {
  const test = (hidden: boolean) => ({ inputs: [{ value: "" }], expected: "", hidden });
  return {
    title: "",
    difficulty: "easy",
    categoryIds: [],
    descriptionMd: "",
    constraints: [],
    hints: [],
    functionName: "solve",
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    comparator: "exact",
    inPlaceArg: "none",
    tests: [test(false), test(true), test(true)],
    referenceLanguage: "javascript",
    referenceCode: "",
  };
}

const json = (v: unknown) => JSON.stringify(v);

export function formFromQuestion(q: QuestionInput | QuestionRecord): QuestionForm {
  return {
    title: q.title,
    difficulty: q.difficulty,
    categoryIds: q.categoryIds,
    descriptionMd: q.descriptionMd,
    constraints: q.constraints.map((value) => ({ value })),
    hints: q.hints.map((value) => ({ value })),
    functionName: q.signature.functionName,
    params: q.signature.params.map((p) => ({
      name: p.name,
      type: p.type === "void" ? "int" : p.type,
    })),
    returns: q.signature.returns,
    comparator: q.comparator,
    inPlaceArg: q.inPlaceArg === null ? "none" : String(q.inPlaceArg),
    tests: q.tests.map((t) => ({
      inputs: t.input.map((v) => ({ value: json(v) })),
      expected: json(t.expected),
      hidden: t.hidden,
    })),
    referenceLanguage: q.reference?.language ?? "javascript",
    referenceCode: q.reference?.code ?? "",
  };
}

export function questionFromForm(
  form: QuestionForm,
  meta: { origin: QuestionInput["origin"]; forkedFrom: string | null },
): QuestionInput {
  return {
    title: form.title.trim(),
    difficulty: form.difficulty,
    categoryIds: form.categoryIds,
    descriptionMd: form.descriptionMd.trim(),
    constraints: form.constraints.map((c) => c.value.trim()),
    hints: form.hints.map((h) => h.value.trim()),
    signature: {
      functionName: form.functionName.trim(),
      params: form.params.map((p) => ({ name: p.name.trim(), type: p.type })),
      returns: form.returns,
    },
    comparator: form.comparator,
    inPlaceArg: form.inPlaceArg === "none" ? null : Number(form.inPlaceArg),
    tests: form.tests.map((t) => ({
      input: t.inputs.map((i) => JSON.parse(i.value) as unknown),
      expected: JSON.parse(t.expected) as unknown,
      hidden: t.hidden,
    })),
    reference: form.referenceCode.trim()
      ? { language: form.referenceLanguage, code: form.referenceCode }
      : null,
    origin: meta.origin,
    forkedFrom: meta.forkedFrom,
  };
}

// ---------------------------------------------------------------------------
// Generate with AI
// ---------------------------------------------------------------------------

export const generateRequestSchema = z.object({
  topic: z.string().trim().min(2, "Pick or type a topic").max(40, "Keep the topic short"),
  difficulty: difficultySchema,
  count: z.number().int().min(1, "At least 1").max(5, "At most 5 at a time"),
  notes: z.string().trim().max(500, "Keep notes under 500 characters"),
  planId: z.string().nullable(),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/** Form version: count is typed as text, so the schema converts and range-checks it. */
export const generateFormSchema = generateRequestSchema.extend({
  count: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((v) => Number(v) >= 1 && Number(v) <= 5, "Generate between 1 and 5 at a time"),
  planId: z.string(),
});
export type GenerateForm = z.infer<typeof generateFormSchema>;

export const generatedQuestionSchema = z.object({
  question: questionInputSchema,
  verifiedTests: z.number().int(),
  droppedTests: z.number().int(),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const generateProgressSchema = z.enum(["writing", "testing", "verifying", "done"]);
export type GenerateProgress = z.infer<typeof generateProgressSchema>;
