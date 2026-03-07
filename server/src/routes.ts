import {
  getEmailsByThread,
  getPropertyName,
  getThreadState,
  updateThreadState,
  loadState,
  resetState,
} from "./state";
import {
  getAnalytics,
  recordSentItem,
  recordThreadAnalyzed,
  resetAnalytics,
} from "./analytics";
import { analyzeThread, generateDraftEmail } from "./llm";
import type {
  AnalyzedThreadEvent,
  DashboardSummary,
  ThreadSummary,
  ThreadDetail,
  TrafficLight,
  UrgencyLevel,
  ThreadAction,
  ActionType,
  Extraction,
  SentItem,
} from "../../shared/types";

// ── Helpers ──────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function overallHealth(extraction: Extraction | null): TrafficLight {
  if (!extraction) return "red";
  const fields = [
    extraction.sender_name.status,
    extraction.sender_type.status,
    extraction.urgency.status,
    extraction.summary.status,
    extraction.property.status,
  ];
  const problemStatuses = extraction.problems.map((p) => p.status);
  const all = [...fields, ...problemStatuses];
  if (all.includes("red")) return "red";
  if (all.includes("orange")) return "orange";
  return "green";
}

function buildAnalyzedEvent(
  threadId: string,
  extraction: Extraction,
  analyzedAt: string
): AnalyzedThreadEvent {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  const firstEmail = emails?.[0];
  const propertyId =
    emails?.find((email) => email.from.property_id)?.from.property_id ?? undefined;

  return {
    thread_id: threadId,
    subject: firstEmail?.subject ?? "Unknown subject",
    property_name: getPropertyName(propertyId),
    analyzed_at: analyzedAt,
    overall_health: overallHealth(extraction),
    urgency: extraction.urgency?.value ?? null,
  };
}

function buildSentItem(
  threadId: string,
  action: ThreadAction,
  sentAt: string
): SentItem {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  const firstEmail = emails?.[0];
  const propertyId =
    emails?.find((email) => email.from.property_id)?.from.property_id ?? undefined;

  return {
    id: `${threadId}:${action.id}`,
    thread_id: threadId,
    action_id: action.id,
    action_type: action.type,
    description: action.description,
    draft_email: action.draft_email,
    sent_at: sentAt,
    subject: firstEmail?.subject ?? "Unknown subject",
    property_name: getPropertyName(propertyId),
    recipient_name: firstEmail?.from.name ?? "Unknown recipient",
    recipient_email: firstEmail?.from.email ?? "unknown@example.com",
  };
}

// ── GET /threads ─────────────────────────────────────────────────────
export function handleGetThreads(): Response {
  const threadMap = getEmailsByThread();
  const state = loadState();

  const summaries: ThreadSummary[] = [];

  for (const [threadId, emails] of threadMap) {
    const firstEmail = emails[0]!;
    const lastEmail = emails[emails.length - 1]!;
    const threadState = state.threads[threadId];

    // Find the property for this thread
    const propertyId =
      emails.find((e) => e.from.property_id)?.from.property_id ?? undefined;

    summaries.push({
      thread_id: threadId,
      subject: firstEmail.subject,
      last_email_timestamp: lastEmail.timestamp,
      email_count: emails.length,
      sender_name: firstEmail.from.name,
      sender_type: firstEmail.from.type,
      property_name: getPropertyName(propertyId),
      status: threadState?.status ?? "pending",
      urgency: (threadState?.extraction?.urgency?.value as UrgencyLevel) ?? null,
      overall_health: overallHealth(threadState?.extraction ?? null),
      problem_count: threadState?.extraction?.problems?.length ?? 0,
      unread_count: emails.filter((e) => !e.read).length,
    });
  }

  // Sort: critical first, then by timestamp (newest first)
  const urgencyOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  summaries.sort((a, b) => {
    // Pending items first
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    // Then by urgency
    const ua = urgencyOrder[a.urgency ?? "medium"] ?? 2;
    const ub = urgencyOrder[b.urgency ?? "medium"] ?? 2;
    if (ua !== ub) return ua - ub;
    // Then by timestamp
    return (
      new Date(b.last_email_timestamp).getTime() -
      new Date(a.last_email_timestamp).getTime()
    );
  });

  return json(summaries);
}

// ── GET /sent ────────────────────────────────────────────────────────
export function handleGetSent(): Response {
  const analytics = getAnalytics();
  const sent = [...analytics.sent_items].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );
  return json(sent);
}

// ── GET /dashboard ───────────────────────────────────────────────────
export function handleGetDashboard(): Response {
  const threadMap = getEmailsByThread();
  const state = loadState();
  const analytics = getAnalytics();

  const threadHealth: Record<TrafficLight, number> = {
    green: 0,
    orange: 0,
    red: 0,
  };
  const threadStatus: DashboardSummary["thread_status"] = {
    pending: 0,
    analyzed: 0,
    reviewing: 0,
    resolved: 0,
  };
  const problemStatus: Record<TrafficLight, number> = {
    green: 0,
    orange: 0,
    red: 0,
  };

  let analyzed = 0;
  let resolved = 0;

  for (const threadId of threadMap.keys()) {
    const threadState = state.threads[threadId];
    if (!threadState) continue;

    threadHealth[overallHealth(threadState.extraction)]++;
    threadStatus[threadState.status]++;

    if (threadState.extraction) {
      analyzed++;
      for (const problem of threadState.extraction.problems) {
        problemStatus[problem.status]++;
      }
    }

    if (threadState.status === "resolved") {
      resolved++;
    }
  }

  const summary: DashboardSummary = {
    generated_at: new Date().toISOString(),
    totals: {
      threads: threadMap.size,
      analyzed,
      resolved,
      sent_actions: analytics.sent_items.length,
    },
    thread_health: threadHealth,
    thread_status: threadStatus,
    problem_status: problemStatus,
    recent_analyzed: analytics.analyzed_threads
      .slice()
      .sort((a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime())
      .slice(0, 8),
    recent_sent: analytics.sent_items
      .slice()
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      .slice(0, 8),
  };

  return json(summary);
}

// ── GET /threads/:id ─────────────────────────────────────────────────
export function handleGetThread(threadId: string): Response {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  if (!emails) return error("Thread not found", 404);

  const threadState = getThreadState(threadId);
  const propertyId =
    emails.find((e) => e.from.property_id)?.from.property_id ?? undefined;

  const detail: ThreadDetail = {
    thread_id: threadId,
    subject: emails[0]!.subject,
    emails,
    state: threadState,
    property_name: getPropertyName(propertyId),
  };

  return json(detail);
}

// ── POST /threads/:id/analyze ────────────────────────────────────────
export async function handleAnalyzeThread(threadId: string): Promise<Response> {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  if (!emails) return error("Thread not found", 404);

  try {
    const extraction = await analyzeThread(emails);
    const analyzedAt = new Date().toISOString();

    updateThreadState(threadId, (s) => {
      s.extraction = extraction;
      s.status = "analyzed";
    });
    recordThreadAnalyzed(buildAnalyzedEvent(threadId, extraction, analyzedAt));

    return json({ success: true, extraction });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(`Analysis failed: ${message}`, 500);
  }
}

// ── POST /threads/analyze-all ────────────────────────────────────────
export async function handleAnalyzeAll(): Promise<Response> {
  const threadMap = getEmailsByThread();
  const state = loadState();
  const pending = [...threadMap.keys()].filter(
    (id) => !state.threads[id]?.extraction
  );

  let completed = 0;
  let failed = 0;

  for (const threadId of pending) {
    const emails = threadMap.get(threadId)!;
    try {
      const extraction = await analyzeThread(emails);
      const analyzedAt = new Date().toISOString();
      updateThreadState(threadId, (s) => {
        s.extraction = extraction;
        s.status = "analyzed";
      });
      recordThreadAnalyzed(buildAnalyzedEvent(threadId, extraction, analyzedAt));
      completed++;
    } catch {
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return json({ completed, failed, total: pending.length });
}

// ── PATCH /threads/:id ───────────────────────────────────────────────
export async function handleUpdateThread(
  threadId: string,
  body: unknown
): Promise<Response> {
  const threadMap = getEmailsByThread();
  if (!threadMap.has(threadId)) return error("Thread not found", 404);

  const update = body as Record<string, unknown>;

  updateThreadState(threadId, (s) => {
    // Update extraction fields
    if (update.extraction && s.extraction) {
      const ext = update.extraction as Record<string, unknown>;
      for (const [key, value] of Object.entries(ext)) {
        if (key === "problems" && Array.isArray(value)) {
          s.extraction.problems = value as Extraction["problems"];
        } else if (key in s.extraction) {
          (s.extraction as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }

    // Update status
    if (typeof update.status === "string") {
      s.status = update.status as ThreadDetail["state"]["status"];
    }

    // Update notes
    if (typeof update.human_notes === "string") {
      s.human_notes = update.human_notes;
    }
  });

  return json(getThreadState(threadId));
}

// ── POST /threads/:id/action ─────────────────────────────────────────
export async function handleThreadAction(
  threadId: string,
  body: unknown
): Promise<Response> {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  if (!emails) return error("Thread not found", 404);

  const { type, problem_id, description } = body as {
    type: ActionType;
    problem_id?: string;
    description?: string;
  };

  if (!type) return error("action type is required");

  const threadState = getThreadState(threadId);
  const problem =
    problem_id && threadState.extraction
      ? threadState.extraction.problems.find((p) => p.id === problem_id) ?? null
      : null;

  // Generate draft email for the action
  let draftEmail: string | null = null;
  try {
    draftEmail = await generateDraftEmail(emails, threadState.extraction, type, problem);
  } catch {
    draftEmail = null;
  }

  const action: ThreadAction = {
    id: `action_${Date.now()}`,
    type,
    description: description ?? `${type} triggered`,
    timestamp: new Date().toISOString(),
    draft_email: draftEmail,
    approved: false,
  };

  updateThreadState(threadId, (s) => {
    s.actions.push(action);
    // If the action is for a specific problem, update its status
    if (problem_id && s.extraction) {
      const prob = s.extraction.problems.find((p) => p.id === problem_id);
      if (prob && prob.status === "red") {
        prob.status = "orange";
      }
    }
  });

  return json(action);
}

// ── POST /threads/:id/action/:actionId/approve ──────────────────────
export function handleApproveAction(
  threadId: string,
  actionId: string
): Response {
  const threadMap = getEmailsByThread();
  if (!threadMap.has(threadId)) return error("Thread not found", 404);

  const sentAt = new Date().toISOString();
  let approvedAction: ThreadAction | null = null;

  updateThreadState(threadId, (s) => {
    const action = s.actions.find((a) => a.id === actionId);
    if (action && !action.approved) {
      action.approved = true;
      approvedAction = action;
    }
  });

  if (approvedAction) {
    recordSentItem(buildSentItem(threadId, approvedAction, sentAt));
  }

  return json({ success: true });
}

// ── POST /threads/:id/resolve ────────────────────────────────────────
export function handleResolveThread(threadId: string): Response {
  const threadMap = getEmailsByThread();
  if (!threadMap.has(threadId)) return error("Thread not found", 404);

  const threadState = getThreadState(threadId);
  if (threadState.extraction) {
    const health = overallHealth(threadState.extraction);
    if (health === "red") {
      return error("Cannot resolve: thread has red-status items", 400);
    }
  }

  updateThreadState(threadId, (s) => {
    s.status = "resolved";
  });

  return json({ success: true });
}

// ── POST /reset ──────────────────────────────────────────────────────
export function handleReset(): Response {
  resetState();
  resetAnalytics();
  return json({ success: true });
}
