import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  getEmailsByThread,
  getPropertyName,
  loadState,
} from "./state";
import type {
  AnalyticsState,
  AnalyzedThreadEvent,
  Extraction,
  SentItem,
} from "../../shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANALYTICS_PATH = join(__dirname, "../../analytics.json");
const MAX_RECENT_ANALYZED = 200;
const MAX_SENT_ITEMS = 500;

let _analytics: AnalyticsState | null = null;

function overallHealth(extraction: Extraction): "green" | "orange" | "red" {
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

function normalizeAnalytics(data: unknown): AnalyticsState | null {
  if (!data || typeof data !== "object") return null;
  const parsed = data as Partial<AnalyticsState>;
  if (!Array.isArray(parsed.sent_items) || !Array.isArray(parsed.analyzed_threads)) {
    return null;
  }
  return {
    last_updated:
      typeof parsed.last_updated === "string"
        ? parsed.last_updated
        : new Date().toISOString(),
    sent_items: parsed.sent_items as SentItem[],
    analyzed_threads: parsed.analyzed_threads as AnalyzedThreadEvent[],
  };
}

function buildAnalyticsFromState(): AnalyticsState {
  const state = loadState();
  const threadMap = getEmailsByThread();
  const analyzedThreads: AnalyzedThreadEvent[] = [];
  const sentItems: SentItem[] = [];

  for (const [threadId, threadState] of Object.entries(state.threads)) {
    const emails = threadMap.get(threadId);
    if (!emails?.length) continue;

    const firstEmail = emails[0]!;
    const propertyId =
      emails.find((email) => email.from.property_id)?.from.property_id ?? undefined;
    const propertyName = getPropertyName(propertyId);

    if (threadState.extraction) {
      analyzedThreads.push({
        thread_id: threadId,
        subject: firstEmail.subject,
        property_name: propertyName,
        analyzed_at: state.last_updated,
        overall_health: overallHealth(threadState.extraction),
        urgency: threadState.extraction.urgency?.value ?? null,
      });
    }

    for (const action of threadState.actions) {
      if (!action.approved) continue;
      sentItems.push({
        id: `${threadId}:${action.id}`,
        thread_id: threadId,
        action_id: action.id,
        action_type: action.type,
        description: action.description,
        draft_email: action.draft_email,
        sent_at: action.timestamp,
        subject: firstEmail.subject,
        property_name: propertyName,
        recipient_name: firstEmail.from.name,
        recipient_email: firstEmail.from.email,
      });
    }
  }

  analyzedThreads.sort(
    (a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()
  );
  sentItems.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

  return {
    last_updated: new Date().toISOString(),
    sent_items: sentItems.slice(0, MAX_SENT_ITEMS),
    analyzed_threads: analyzedThreads.slice(0, MAX_RECENT_ANALYZED),
  };
}

function saveAnalytics(): void {
  if (!_analytics) return;
  _analytics.last_updated = new Date().toISOString();
  writeFileSync(ANALYTICS_PATH, JSON.stringify(_analytics, null, 2));
}

function loadAnalytics(): AnalyticsState {
  if (_analytics) return _analytics;

  if (existsSync(ANALYTICS_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(ANALYTICS_PATH, "utf-8")) as unknown;
      const normalized = normalizeAnalytics(parsed);
      if (normalized) {
        if (normalized.sent_items.length === 0 && normalized.analyzed_threads.length === 0) {
          const rebuilt = buildAnalyticsFromState();
          if (rebuilt.sent_items.length > 0 || rebuilt.analyzed_threads.length > 0) {
            _analytics = rebuilt;
            saveAnalytics();
            return _analytics;
          }
        }
        _analytics = normalized;
        return _analytics;
      }
    } catch {
      _analytics = null;
    }
  }

  _analytics = buildAnalyticsFromState();
  saveAnalytics();
  return _analytics;
}

function getAnalytics(): AnalyticsState {
  return loadAnalytics();
}

function recordThreadAnalyzed(event: AnalyzedThreadEvent): void {
  const analytics = loadAnalytics();
  const deduped = analytics.analyzed_threads.filter(
    (item) => item.thread_id !== event.thread_id
  );
  analytics.analyzed_threads = [event, ...deduped].slice(0, MAX_RECENT_ANALYZED);
  saveAnalytics();
}

function recordSentItem(item: SentItem): void {
  const analytics = loadAnalytics();
  const alreadyExists = analytics.sent_items.some(
    (existing) =>
      existing.thread_id === item.thread_id && existing.action_id === item.action_id
  );
  if (alreadyExists) return;
  analytics.sent_items = [item, ...analytics.sent_items]
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    .slice(0, MAX_SENT_ITEMS);
  saveAnalytics();
}

function resetAnalytics(): void {
  _analytics = {
    last_updated: new Date().toISOString(),
    sent_items: [],
    analyzed_threads: [],
  };
  saveAnalytics();
}

export {
  getAnalytics,
  loadAnalytics,
  recordSentItem,
  recordThreadAnalyzed,
  resetAnalytics,
};
