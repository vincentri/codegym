import { z } from "zod";

/** Named colors for category dots. Values are CSS colors that read on light and dark. */
export const CATEGORY_COLORS = {
  slate: "oklch(0.65 0.02 260)",
  red: "oklch(0.66 0.19 25)",
  orange: "oklch(0.72 0.16 55)",
  amber: "oklch(0.8 0.15 85)",
  green: "oklch(0.7 0.16 150)",
  teal: "oklch(0.72 0.12 185)",
  blue: "oklch(0.66 0.15 250)",
  violet: "oklch(0.64 0.18 295)",
  pink: "oklch(0.7 0.17 350)",
} as const;
export const categoryColorSchema = z.enum(
  Object.keys(CATEGORY_COLORS) as [
    keyof typeof CATEGORY_COLORS,
    ...(keyof typeof CATEGORY_COLORS)[],
  ],
);
export type CategoryColor = z.infer<typeof categoryColorSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: categoryColorSchema,
  description: z.string(),
  builtin: z.boolean(),
  questionCount: z.number().int(),
  solvedCount: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryFormSchema = z.object({
  id: z.string().nullable(),
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(32, "Keep the name under 32 characters"),
  color: categoryColorSchema,
  description: z.string().trim().max(200, "Keep the description under 200 characters"),
});
export type CategoryForm = z.infer<typeof categoryFormSchema>;

/** Adds the unique-name rule, which needs the existing categories. */
export function categoryFormSchemaWithNames(existing: { id: string; name: string }[]) {
  return categoryFormSchema.superRefine((value, ctx) => {
    const taken = existing.some(
      (c) => c.id !== value.id && c.name.toLowerCase() === value.name.trim().toLowerCase(),
    );
    if (taken) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "A category with this name exists" });
    }
  });
}
