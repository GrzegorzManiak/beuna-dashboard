import { apiFetch } from "./client";
import type {
  ThreadSummary,
  ThreadDetail,
  Extraction,
  ThreadAction,
  ThreadState,
} from "@shared/types";

export const threadsApi = {
  list: () => apiFetch<ThreadSummary[]>("/threads"),

  get: (id: string) => apiFetch<ThreadDetail>(`/threads/${id}`),

  analyze: (id: string) =>
    apiFetch<{ success: boolean; extraction: Extraction }>(
      `/threads/${id}/analyze`,
      { method: "POST" }
    ),

  analyzeAll: () =>
    apiFetch<{ completed: number; failed: number; total: number }>(
      "/threads/analyze-all",
      { method: "POST" }
    ),

  update: (id: string, data: Partial<ThreadState>) =>
    apiFetch<ThreadState>(`/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  triggerAction: (
    id: string,
    type: string,
    problemId?: string,
    description?: string
  ) =>
    apiFetch<ThreadAction>(`/threads/${id}/action`, {
      method: "POST",
      body: JSON.stringify({ type, problem_id: problemId, description }),
    }),

  approveAction: (threadId: string, actionId: string) =>
    apiFetch<{ success: boolean }>(
      `/threads/${threadId}/action/${actionId}/approve`,
      { method: "POST" }
    ),

  resolve: (id: string) =>
    apiFetch<{ success: boolean }>(`/threads/${id}/resolve`, {
      method: "POST",
    }),

  reset: () => apiFetch<{ success: boolean }>("/reset", { method: "POST" }),
};
