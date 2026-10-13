import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiProfileForm, AppSettings, Language, RunRequest } from "@/schemas";
import { api } from "./client";
import { queryKeys } from "./keys";
import type { ActivityEvent } from "./types";

export function useProblems() {
  return useQuery({ queryKey: queryKeys.problems, queryFn: () => api.listProblems() });
}

export function useProblem(id: string) {
  return useQuery({ queryKey: queryKeys.problem(id), queryFn: () => api.getProblem(id) });
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
