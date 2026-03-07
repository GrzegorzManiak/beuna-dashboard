import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { threadsApi } from "@/api/threads";

export function useHealthQuery() {
  return useQuery({
    queryKey: ["health"],
    queryFn: threadsApi.health,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useThreadsQuery() {
  return useQuery({
    queryKey: ["threads"],
    queryFn: threadsApi.list,
    refetchInterval: 10_000,
  });
}

export function useSentQuery() {
  return useQuery({
    queryKey: ["sent"],
    queryFn: threadsApi.getSent,
    refetchInterval: 10_000,
  });
}

export function useDashboardQuery() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: threadsApi.getDashboard,
    refetchInterval: 10_000,
  });
}

export function useThreadQuery(id: string | undefined) {
  return useQuery({
    queryKey: ["thread", id],
    queryFn: () => threadsApi.get(id!),
    enabled: !!id,
  });
}

export function useAnalyzeThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => threadsApi.analyze(threadId),
    onSuccess: (_data, threadId) => {
      void qc.invalidateQueries({ queryKey: ["thread", threadId] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAnalyzeAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => threadsApi.analyzeAll(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      threadsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["thread", id] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useTriggerAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      type,
      problemId,
      description,
    }: {
      threadId: string;
      type: string;
      problemId?: string;
      description?: string;
    }) => threadsApi.triggerAction(threadId, type, problemId, description),
    onSuccess: (_data, { threadId }) => {
      void qc.invalidateQueries({ queryKey: ["thread", threadId] });
      void qc.invalidateQueries({ queryKey: ["sent"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useApproveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      actionId,
    }: {
      threadId: string;
      actionId: string;
    }) => threadsApi.approveAction(threadId, actionId),
    onSuccess: (_data, { threadId }) => {
      void qc.invalidateQueries({ queryKey: ["thread", threadId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useResolveThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => threadsApi.resolve(threadId),
    onSuccess: (_data, threadId) => {
      void qc.invalidateQueries({ queryKey: ["thread", threadId] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
