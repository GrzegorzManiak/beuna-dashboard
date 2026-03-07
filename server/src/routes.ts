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
import { analyzeThread, generateDraftEmail, generateCombinedDraftEmail } from "./llm";
import type {
  ActionType,
  AnalyzedThreadEvent,
  DashboardSummary,
  Extraction,
  Problem,
  SeedEmail,
  SentItem,
  ThreadAction,
  ThreadDetail,
  ThreadSummary,
  TrafficLight,
  UrgencyLevel,
} from "../../shared/types";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

const INTERNAL_SUPPORT_RECIPIENT = {
  name: "Human Support",
  email: "support@manageco.ie",
};

function getPrimaryExternalSender(emails: SeedEmail[] | undefined): {
  name: string;
  email: string;
} {
  const sender =
    emails?.find(
      (email) =>
        email.from.type !== "internal" && !email.from.email.endsWith("@manageco.ie")
    ) ?? emails?.[0];

  return {
    name: sender?.from.name ?? "Unknown recipient",
    email: sender?.from.email ?? "unknown@example.com",
  };
}

function deriveActionDrivenStatus(
  actions: ThreadAction[]
): ThreadDetail["state"]["status"] {
  if (actions.some((action) => !action.approved)) return "reviewing";
  if (actions.some((action) => action.approved)) return "in_progress";
  return "analyzed";
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
  const problemStatuses = extraction.problems.map((problem) => problem.status);
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
  const recipient =
    action.type === "forward_to_human"
      ? INTERNAL_SUPPORT_RECIPIENT
      : getPrimaryExternalSender(emails);

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
    recipient_name: recipient.name,
    recipient_email: recipient.email,
  };
}

function shouldEscalateToHumanSupport(problem: Problem): boolean {
  const category = problem.category?.toLowerCase() ?? "";
  return problem.status === "red" || category === "legal" || category === "compliance";
}

async function autoTriggerActions(
  threadId: string,
  emails: SeedEmail[],
  extraction: Extraction,
  existingActions: ThreadAction[]
): Promise<ThreadAction[]> {
  const createdActions: ThreadAction[] = [];
  const createdAt = new Date().toISOString();
  const actionIdBase = Date.now();

  const hasCombinedReply = existingActions.some(
    (action) => action.type === "reply" && !action.problem_id
  );
  if (!hasCombinedReply && extraction.problems.length > 0) {
    let draftEmail: string | null = null;
    try {
      draftEmail = await generateCombinedDraftEmail(emails, extraction, extraction.problems);
    } catch {
      draftEmail = null;
    }

    createdActions.push({
      id: `action_${actionIdBase}_reply`,
      type: "reply",
      description: `Auto: combined response addressing ${extraction.problems.length} issue(s)`,
      timestamp: createdAt,
      draft_email: draftEmail,
      approved: true,
      auto_triggered: true,
      problem_id: null,
    });
  }

  const escalationProblems = extraction.problems.filter(shouldEscalateToHumanSupport);
  const hasSupportEscalation = existingActions.some(
    (action) => action.type === "forward_to_human" && !action.problem_id
  );
  if (escalationProblems.length > 0 && !hasSupportEscalation) {
    let draftEmail: string | null = null;
    try {
      draftEmail = await generateDraftEmail(
        emails,
        extraction,
        "forward_to_human",
        null
      );
    } catch {
      draftEmail = null;
    }

    createdActions.push({
      id: `action_${actionIdBase}_support`,
      type: "forward_to_human",
      description: `Auto: prepared human-support escalation for ${escalationProblems.length} issue(s)`,
      timestamp: createdAt,
      draft_email: draftEmail,
      approved: false,
      auto_triggered: true,
      problem_id: null,
    });
  }

  if (createdActions.length === 0) return [];

  updateThreadState(threadId, (state) => {
    state.actions.push(...createdActions);
    state.status = deriveActionDrivenStatus(state.actions);
  });

  for (const action of createdActions) {
    if (action.approved) {
      recordSentItem(buildSentItem(threadId, action, action.timestamp));
    }
  }

  return createdActions;
}

export function handleGetThreads(): Response {
  const threadMap = getEmailsByThread();
  const state = loadState();

  const summaries: ThreadSummary[] = [];

  for (const [threadId, emails] of threadMap) {
    const firstEmail = emails[0]!;
    const lastEmail = emails[emails.length - 1]!;
    const threadState = state.threads[threadId];
    const propertyId =
      emails.find((email) => email.from.property_id)?.from.property_id ?? undefined;

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
      unread_count: emails.filter((email) => !email.read).length,
    });
  }

  const urgencyOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  summaries.sort((left, right) => {
    if (left.status === "pending" && right.status !== "pending") return -1;
    if (right.status === "pending" && left.status !== "pending") return 1;

    const leftUrgency = urgencyOrder[left.urgency ?? "medium"] ?? 2;
    const rightUrgency = urgencyOrder[right.urgency ?? "medium"] ?? 2;
    if (leftUrgency !== rightUrgency) return leftUrgency - rightUrgency;

    return (
      new Date(right.last_email_timestamp).getTime() -
      new Date(left.last_email_timestamp).getTime()
    );
  });

  return json(summaries);
}

export function handleGetSent(): Response {
  const analytics = getAnalytics();
  const sent = [...analytics.sent_items].sort(
    (left, right) => new Date(right.sent_at).getTime() - new Date(left.sent_at).getTime()
  );
  return json(sent);
}

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
    in_progress: 0,
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
      .sort(
        (left, right) =>
          new Date(right.analyzed_at).getTime() - new Date(left.analyzed_at).getTime()
      )
      .slice(0, 8),
    recent_sent: analytics.sent_items
      .slice()
      .sort((left, right) => new Date(right.sent_at).getTime() - new Date(left.sent_at).getTime())
      .slice(0, 8),
  };

  return json(summary);
}

export function handleGetThread(threadId: string): Response {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  if (!emails) return error("Thread not found", 404);

  const threadState = getThreadState(threadId);
  const propertyId =
    emails.find((email) => email.from.property_id)?.from.property_id ?? undefined;

  const detail: ThreadDetail = {
    thread_id: threadId,
    subject: emails[0]!.subject,
    emails,
    state: threadState,
    property_name: getPropertyName(propertyId),
  };

  return json(detail);
}

export async function handleAnalyzeThread(threadId: string): Promise<Response> {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  if (!emails) return error("Thread not found", 404);

  try {
    const extraction = await analyzeThread(emails);
    const analyzedAt = new Date().toISOString();

    updateThreadState(threadId, (state) => {
      state.extraction = extraction;
      state.status = "analyzed";
    });
    recordThreadAnalyzed(buildAnalyzedEvent(threadId, extraction, analyzedAt));

    const autoActions = await autoTriggerActions(
      threadId,
      emails,
      extraction,
      getThreadState(threadId).actions
    );
    return json({ success: true, extraction, auto_actions: autoActions.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return error(`Analysis failed: ${message}`, 500);
  }
}

export async function handleAnalyzeAll(): Promise<Response> {
  const threadMap = getEmailsByThread();
  const state = loadState();
  const pending = [...threadMap.keys()].filter((threadId) => !state.threads[threadId]?.extraction);

  let completed = 0;
  let failed = 0;

  for (const threadId of pending) {
    const emails = threadMap.get(threadId)!;
    try {
      const extraction = await analyzeThread(emails);
      const analyzedAt = new Date().toISOString();

      updateThreadState(threadId, (threadState) => {
        threadState.extraction = extraction;
        threadState.status = "analyzed";
      });
      recordThreadAnalyzed(buildAnalyzedEvent(threadId, extraction, analyzedAt));
      await autoTriggerActions(threadId, emails, extraction, getThreadState(threadId).actions);
      completed++;
    } catch {
      failed++;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return json({ completed, failed, total: pending.length });
}

export async function handleUpdateThread(
  threadId: string,
  body: unknown
): Promise<Response> {
  const threadMap = getEmailsByThread();
  const emails = threadMap.get(threadId);
  if (!emails) return error("Thread not found", 404);

  const update = body as Record<string, unknown>;
  const oldState = getThreadState(threadId);
  const oldProblemStatuses = new Map<string, TrafficLight>();

  if (oldState.extraction) {
    for (const problem of oldState.extraction.problems) {
      oldProblemStatuses.set(problem.id, problem.status);
    }
  }

  updateThreadState(threadId, (state) => {
    if (update.extraction && state.extraction) {
      const extractionUpdate = update.extraction as Record<string, unknown>;
      for (const [key, value] of Object.entries(extractionUpdate)) {
        if (key === "problems" && Array.isArray(value)) {
          state.extraction.problems = value as Extraction["problems"];
        } else if (key in state.extraction) {
          (state.extraction as unknown as Record<string, unknown>)[key] = value;
        }
      }
    }

    if (typeof update.status === "string") {
      state.status = update.status as ThreadDetail["state"]["status"];
    }

    if (typeof update.human_notes === "string") {
      state.human_notes = update.human_notes;
    }
  });

  const newState = getThreadState(threadId);
  if (newState.extraction) {
    const changedProblems = newState.extraction.problems.filter((problem) => {
      const oldStatus = oldProblemStatuses.get(problem.id);
      return oldStatus === "red" && (problem.status === "green" || problem.status === "orange");
    });

    if (changedProblems.length > 0) {
      await autoTriggerActions(threadId, emails, newState.extraction, newState.actions);
    }
  }

  return json(getThreadState(threadId));
}

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
      ? threadState.extraction.problems.find((item) => item.id === problem_id) ?? null
      : null;

  let draftEmail: string | null = null;
  try {
    draftEmail = await generateDraftEmail(emails, threadState.extraction, type, problem);
  } catch {
    draftEmail = null;
  }

  const action: ThreadAction = {
    id: `action_${Date.now()}`,
    type,
    description:
      description ??
      (type === "forward_to_human"
        ? "Human support escalation queued"
        : `${type.replace(/_/g, " ")} triggered`),
    timestamp: new Date().toISOString(),
    draft_email: draftEmail,
    approved: false,
    auto_triggered: false,
    problem_id: problem_id ?? null,
  };

  updateThreadState(threadId, (state) => {
    state.actions.push(action);
    if (problem_id && state.extraction) {
      const threadProblem = state.extraction.problems.find((item) => item.id === problem_id);
      if (threadProblem && threadProblem.status === "red") {
        threadProblem.status = "orange";
      }
    }
    state.status = deriveActionDrivenStatus(state.actions);
  });

  return json(action);
}

export function handleApproveAction(threadId: string, actionId: string): Response {
  const threadMap = getEmailsByThread();
  if (!threadMap.has(threadId)) return error("Thread not found", 404);

  const sentAt = new Date().toISOString();
  let approvedAction: ThreadAction | null = null;

  updateThreadState(threadId, (state) => {
    const action = state.actions.find((item) => item.id === actionId);
    if (action && !action.approved) {
      action.approved = true;
      approvedAction = action;
    }

    if (approvedAction) {
      state.status = deriveActionDrivenStatus(state.actions);
    }
  });

  if (approvedAction) {
    recordSentItem(buildSentItem(threadId, approvedAction, sentAt));
  }

  return json({ success: true });
}

export function handleResolveThread(threadId: string): Response {
  const threadMap = getEmailsByThread();
  if (!threadMap.has(threadId)) return error("Thread not found", 404);

  const threadState = getThreadState(threadId);
  if (threadState.extraction && overallHealth(threadState.extraction) === "red") {
    return error("Cannot resolve: thread has red-status items", 400);
  }

  updateThreadState(threadId, (state) => {
    state.status = "resolved";
  });

  return json({ success: true });
}

export function handleReset(): Response {
  resetState();
  resetAnalytics();
  return json({ success: true });
}
