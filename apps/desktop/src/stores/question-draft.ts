import { create } from "zustand";
import type { QuestionInput } from "@/schemas";

/**
 * Hands a question that isn't saved yet (AI import or generation, duplicate) to the editor page.
 */
export const useQuestionDraftStore = create<{
  draft: QuestionInput | null;
  setDraft: (draft: QuestionInput | null) => void;
}>((set) => ({ draft: null, setDraft: (draft) => set({ draft }) }));
