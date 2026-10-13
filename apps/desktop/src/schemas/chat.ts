import { z } from "zod";

export const mentorModeSchema = z.enum([
  "chat",
  "hint",
  "explain",
  "review",
  "debug",
  "complexity",
  "approach",
  "solution",
]);
export type MentorMode = z.infer<typeof mentorModeSchema>;

export const MENTOR_ACTIONS: {
  mode: Exclude<MentorMode, "chat">;
  label: string;
  prompt: string;
}[] = [
  { mode: "hint", label: "Hint", prompt: "Give me a hint." },
  { mode: "explain", label: "Explain problem", prompt: "Explain this problem in simpler words." },
  { mode: "review", label: "Review my code", prompt: "Review my current code." },
  { mode: "debug", label: "Why is it failing?", prompt: "Why is my solution failing?" },
  {
    mode: "complexity",
    label: "Complexity",
    prompt: "What is the time and space complexity of my code?",
  },
  {
    mode: "approach",
    label: "Approach",
    prompt: "Walk me through the optimal approach step by step.",
  },
  { mode: "solution", label: "Show solution", prompt: "Show me a full solution with explanation." },
];

export const chatMessageSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  role: z.enum(["user", "assistant"]),
  mode: mentorModeSchema,
  content: z.string(),
  createdAt: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Chat input form. */
export const chatInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a question first")
    .max(4000, "Keep messages under 4000 characters"),
});
export type ChatInput = z.infer<typeof chatInputSchema>;

export type MentorStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string };
