import { z } from "zod";

export const importProblemFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(40, "Paste the full problem statement (at least 40 characters)")
    .max(20000, "That is too long. Paste only the problem statement and examples."),
});
export type ImportProblemForm = z.infer<typeof importProblemFormSchema>;
