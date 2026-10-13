import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/schemas";

interface UiState {
  mentorOpen: boolean;
  /** Last language picked per problem, so reopening a problem restores it. */
  languageByProblem: Record<string, Language>;
  toggleMentor: () => void;
  setMentorOpen: (open: boolean) => void;
  setLanguage: (problemId: string, language: Language) => void;
}

// UI-only preferences (layout, last tab). Real data lives in the backend.
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mentorOpen: true,
      languageByProblem: {},
      toggleMentor: () => set((s) => ({ mentorOpen: !s.mentorOpen })),
      setMentorOpen: (open) => set({ mentorOpen: open }),
      setLanguage: (problemId, language) =>
        set((s) => ({ languageByProblem: { ...s.languageByProblem, [problemId]: language } })),
    }),
    { name: "codegym-ui" },
  ),
);
