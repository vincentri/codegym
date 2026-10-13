import type { Language } from "@/schemas";

export const queryKeys = {
  problems: ["problems"] as const,
  problem: (id: string) => ["problems", id] as const,
  stats: ["stats"] as const,
  draft: (problemId: string, language: Language) => ["draft", problemId, language] as const,
  starter: (problemId: string, language: Language) => ["starter", problemId, language] as const,
  submissions: (problemId: string) => ["submissions", problemId] as const,
  settings: ["settings"] as const,
  runtimes: ["runtimes"] as const,
  dataInfo: ["dataInfo"] as const,
  aiProfiles: ["aiProfiles"] as const,
  chat: (problemId: string) => ["chat", problemId] as const,
};
