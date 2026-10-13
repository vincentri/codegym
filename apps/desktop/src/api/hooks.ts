import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type {
  AiProfileForm,
  AppSettings,
  CategoryForm,
  GenerateProgress,
  GenerateRequest,
  Language,
  PlanForm,
  QuestionInput,
  ResetProgressRequest,
  RunRequest,
} from "@/schemas";
import { api } from "./client";
import { queryKeys } from "./keys";
import type { ActivityEvent, VerifyRequest } from "./types";

export function useProblems() {
  return useQuery({ queryKey: queryKeys.problems, queryFn: () => api.listProblems() });
}

export function useProblem(id: string) {
  return useQuery({ queryKey: queryKeys.problem(id), queryFn: () => api.getProblem(id) });
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.getDashboard() });
}

/** Wipes progress, then drops every cached query so all screens refetch fresh data. */
export function useResetProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ResetProgressRequest) => api.resetProgress(req),
    onSuccess: () => qc.resetQueries(),
  });
}

export function useStats() {
  return useQuery({ queryKey: queryKeys.stats, queryFn: () => api.getStats() });
}

/** Loads the saved draft, falling back to generated starter code. */
export function useInitialCode(problemId: string, language: Language) {
  return useQuery({
    queryKey: queryKeys.draft(problemId, language),
    queryFn: async () => {
      const draft = await api.getDraft(problemId, language);
      if (draft) return { code: draft.code, savedAt: draft.updatedAt, fromDraft: true };
      return { code: await api.starterCode(problemId, language), savedAt: null, fromDraft: false };
    },
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function useStarterCode(problemId: string, language: Language) {
  return useQuery({
    queryKey: queryKeys.starter(problemId, language),
    queryFn: () => api.starterCode(problemId, language),
    staleTime: Infinity,
  });
}

export function useSaveDraft() {
  return useMutation({
    mutationFn: (v: { problemId: string; language: Language; code: string }) =>
      api.saveDraft(v.problemId, v.language, v.code),
  });
}

export function useRunCode() {
  return useMutation({ mutationFn: (req: RunRequest) => api.runCode(req) });
}

export function useSubmitCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: RunRequest) => api.submitCode(req),
    onSuccess: (_, req) => {
      void qc.invalidateQueries({ queryKey: queryKeys.submissions(req.problemId) });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      void qc.invalidateQueries({ queryKey: queryKeys.problems });
      void qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useSubmissions(problemId: string) {
  return useQuery({
    queryKey: queryKeys.submissions(problemId),
    queryFn: () => api.listSubmissions(problemId),
  });
}

export function useRecordActivity() {
  return useMutation({ mutationFn: (event: ActivityEvent) => api.recordActivity(event) });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api.getSettings() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: AppSettings) => api.updateSettings(s),
    onSuccess: (s) => qc.setQueryData(queryKeys.settings, s),
  });
}

export function useRuntimes() {
  return useQuery({ queryKey: queryKeys.runtimes, queryFn: () => api.detectRuntimes() });
}

export function useDataInfo() {
  return useQuery({ queryKey: queryKeys.dataInfo, queryFn: () => api.dataInfo() });
}

export function useOpenDataFolder() {
  return useMutation({ mutationFn: () => api.openDataFolder() });
}

export function useExportProblemPack() {
  return useMutation({ mutationFn: () => api.exportProblemPack() });
}

export function useImportProblemPack() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: () => api.importProblemPack(),
    onSuccess: (result) => (result && result.imported > 0 ? invalidate() : undefined),
  });
}

export function useAiProfiles() {
  return useQuery({ queryKey: queryKeys.aiProfiles, queryFn: () => api.listAiProfiles() });
}

export function useSaveAiProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: AiProfileForm) => api.saveAiProfile(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiProfiles }),
  });
}

export function useDeleteAiProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAiProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiProfiles }),
  });
}

export function useSetActiveAiProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.setActiveAiProfile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiProfiles }),
  });
}

export function useListModels() {
  return useMutation({ mutationFn: (form: AiProfileForm) => api.listModels(form) });
}

export function useTestConnection() {
  return useMutation({ mutationFn: (form: AiProfileForm) => api.testConnection(form) });
}

export function useChat(problemId: string) {
  return useQuery({ queryKey: queryKeys.chat(problemId), queryFn: () => api.listChat(problemId) });
}

export function useClearChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (problemId: string) => api.clearChat(problemId),
    onSuccess: (_, problemId) => qc.invalidateQueries({ queryKey: queryKeys.chat(problemId) }),
  });
}

export function useImportProblem() {
  return useMutation({ mutationFn: (text: string) => api.importProblem(text) });
}

// --- Question Bank ------------------------------------------------------------

/** Everything that shows question data; refreshed after any bank change. */
function useInvalidateBank() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [
        queryKeys.problems,
        queryKeys.bank,
        queryKeys.categories,
        queryKeys.plans,
        queryKeys.stats,
        queryKeys.dashboard,
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
}

export function useBankQuestions() {
  return useQuery({ queryKey: queryKeys.bank, queryFn: () => api.listBankQuestions() });
}

export function useQuestion(id: string | null) {
  return useQuery({
    queryKey: queryKeys.question(id ?? "none"),
    queryFn: () => api.getQuestion(id!),
    enabled: id !== null,
  });
}

export function useCreateQuestion() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: (input: QuestionInput) => api.createQuestion(input),
    onSuccess: invalidate,
  });
}

export function useUpdateQuestion() {
  const invalidate = useInvalidateBank();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: QuestionInput }) => api.updateQuestion(v.id, v.input),
    onSuccess: async (q) => {
      qc.setQueryData(queryKeys.question(q.id), q);
      await qc.invalidateQueries({ queryKey: queryKeys.problem(q.id) });
      await invalidate();
    },
  });
}

export function useDeleteQuestions() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: (ids: string[]) => api.deleteQuestions(ids),
    onSuccess: invalidate,
  });
}

export function useSetHidden() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: (v: { ids: string[]; hidden: boolean }) => api.setHidden(v.ids, v.hidden),
    onSuccess: invalidate,
  });
}

export function useVerifyReference() {
  return useMutation({ mutationFn: (req: VerifyRequest) => api.verifyReference(req) });
}

export function useGenerateQuestions() {
  const [step, setStep] = useState<GenerateProgress | null>(null);
  const mutation = useMutation({
    mutationFn: (req: GenerateRequest) => api.generateQuestions(req, setStep),
    onSettled: () => setStep(null),
  });
  return { ...mutation, step };
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: () => api.listCategories() });
}

export function useSaveCategory() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: (form: CategoryForm) => api.saveCategory(form),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (id: string) => api.deleteCategory(id), onSuccess: invalidate });
}

export function useSetQuestionCategories() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: (v: { ids: string[]; add: string[]; remove: string[] }) =>
      api.setQuestionCategories(v.ids, v.add, v.remove),
    onSuccess: invalidate,
  });
}

// --- Study plans --------------------------------------------------------------

export function usePlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: () => api.listPlans() });
}

/** Pass "" to skip loading (e.g. no plan filter selected). */
export function usePlan(id: string) {
  return useQuery({
    queryKey: queryKeys.plan(id),
    queryFn: () => api.getPlan(id),
    enabled: id !== "",
  });
}

export function useSavePlan() {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (form: PlanForm) => api.savePlan(form), onSuccess: invalidate });
}

export function useDuplicatePlan() {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (id: string) => api.duplicatePlan(id), onSuccess: invalidate });
}

export function useDeletePlan() {
  const invalidate = useInvalidateBank();
  return useMutation({ mutationFn: (id: string) => api.deletePlan(id), onSuccess: invalidate });
}

export function useSetPlanItems() {
  const invalidate = useInvalidateBank();
  return useMutation({
    mutationFn: (v: { id: string; problemIds: string[] }) => api.setPlanItems(v.id, v.problemIds),
    onSuccess: invalidate,
  });
}
