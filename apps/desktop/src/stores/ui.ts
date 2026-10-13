import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/schemas";

interface UiState {
  sidebarOpen: boolean;
  mentorOpen: boolean;
  /** Last language picked per problem, so reopening a problem restores it. */
  languageByProblem: Record<string, Language>;
  setSidebarOpen: (open: boolean) => void;
  toggleMentor: () => void;
  setMentorOpen: (open: boolean) => void;
  setLanguage: (problemId: string, language: Language) => void;
  /** Forget per-problem choices (used by Reset progress). */
  clearProblemPrefs: () => void;
}

// UI-only preferences (layout, last tab). Real data lives in the backend.
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mentorOpen: true,
      languageByProblem: {},
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleMentor: () => set((s) => ({ mentorOpen: !s.mentorOpen })),
      setMentorOpen: (open) => set({ mentorOpen: open }),
      setLanguage: (problemId, language) =>
        set((s) => ({ languageByProblem: { ...s.languageByProblem, [problemId]: language } })),
      clearProblemPrefs: () => set({ languageByProblem: {} }),
    }),
    { name: "codegym-ui" },
  ),
);
