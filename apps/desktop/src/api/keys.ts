import type { Language } from "@/schemas";

export const queryKeys = {
  problems: ["problems"] as const,
  problem: (id: string) => ["problems", id] as const,
  stats: ["stats"] as const,
  dashboard: ["dashboard"] as const,
  draft: (problemId: string, language: Language) => ["draft", problemId, language] as const,
  starter: (problemId: string, language: Language) => ["starter", problemId, language] as const,
  submissions: (problemId: string) => ["submissions", problemId] as const,
  settings: ["settings"] as const,
  runtimes: ["runtimes"] as const,
  dataInfo: ["dataInfo"] as const,
  aiProfiles: ["aiProfiles"] as const,
  chat: (problemId: string) => ["chat", problemId] as const,
  bank: ["bank"] as const,
  question: (id: string) => ["bank", id] as const,
  categories: ["categories"] as const,
  plans: ["plans"] as const,
  plan: (id: string) => ["plans", id] as const,
};
