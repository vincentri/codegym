import { z } from "zod";
import { languageSchema } from "./language";
import { planSummarySchema } from "./plan";
import { problemSummarySchema } from "./problem";
import { submissionSchema } from "./run";

export const dashboardSchema = z.object({
  /** The most recent problem you attempted but have not solved yet. */
  continueProblem: z
    .object({
      problem: problemSummarySchema,
      attempts: z.number().int(),
      language: languageSchema,
      lastActiveAt: z.string(),
    })
    .nullable(),
  /** The study plan you touched most recently. */
  plan: planSummarySchema.nullable(),
  recentSubmissions: z.array(submissionSchema.extend({ problemTitle: z.string() })),
  /** Unsolved problems in the topic where you have solved the smallest share. */
  suggestion: z
    .object({
      topic: z.string(),
      solved: z.number().int(),
      total: z.number().int(),
      problems: z.array(problemSummarySchema),
    })
    .nullable(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const resetProgressRequestSchema = z.object({
  includeCustomProblems: z.boolean(),
});
export type ResetProgressRequest = z.infer<typeof resetProgressRequestSchema>;
