import { z } from "zod";
import { problemSummarySchema } from "./problem";

export const planSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  builtin: z.boolean(),
  solved: z.number().int(),
  total: z.number().int(),
  next: problemSummarySchema.nullable(),
  updatedAt: z.string(),
});
export type PlanSummary = z.infer<typeof planSummarySchema>;

export const planDetailSchema = planSummarySchema.extend({
  items: z.array(problemSummarySchema),
});
export type PlanDetail = z.infer<typeof planDetailSchema>;

export const planFormSchema = z.object({
  id: z.string().nullable(),
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(60, "Keep the name under 60 characters"),
  description: z.string().trim().max(300, "Keep the description under 300 characters"),
});
export type PlanForm = z.infer<typeof planFormSchema>;
