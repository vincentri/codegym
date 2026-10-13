import { z } from "zod";
import { problemOriginSchema } from "./problem";
import { questionInputSchema } from "./question";

/** A `.codegym.json` problem pack: your own questions plus the custom categories they use. */
export const problemPackSchema = z.object({
  format: z.literal("codegym-problem-pack"),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  categories: z.array(
    z.object({ id: z.string(), name: z.string(), color: z.string(), description: z.string() }),
  ),
  // Imports turn a "builtin" origin into "manual", so any origin is accepted here.
  questions: z.array(questionInputSchema.extend({ origin: problemOriginSchema })),
});
export type ProblemPack = z.infer<typeof problemPackSchema>;

export const packExportSchema = z.object({
  path: z.string(),
  questions: z.number().int(),
});
export type PackExport = z.infer<typeof packExportSchema>;

export const packImportSchema = z.object({
  imported: z.number().int(),
  categoriesCreated: z.number().int(),
  skipped: z.array(z.object({ title: z.string(), reason: z.string() })),
});
export type PackImport = z.infer<typeof packImportSchema>;
