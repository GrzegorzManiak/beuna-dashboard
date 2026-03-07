// ── Traffic Light Status ─────────────────────────────────────────────
export type TrafficLight = "green" | "orange" | "red";

// ── Enums ────────────────────────────────────────────────────────────
export type SenderType =
  | "tenant"
  | "landlord"
  | "contractor"
  | "prospect"
  | "internal"
  | "legal"
  | "system"
  | "external"
  | "unknown";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";

export type ThreadStatus = "pending" | "analyzed" | "reviewing" | "resolved";

export type ActionType =
  | "maintenance_request"
  | "contractor_dispatch"
  | "request_info"
  | "acknowledge"
  | "reply"
  | "escalate";

// ── Seed Data (TASK.json shape) ──────────────────────────────────────
export interface SeedEmail {
  id: string;
  thread_id: string;
  thread_position: number;
  timestamp: string;
  from: {
    name: string;
    email: string;
    type: string;
    unit?: string;
    property_id?: string;
    role?: string;
    company?: string;
  };
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachments: string[];
  read: boolean;
}

export interface SeedData {
  metadata: {
    dataset_version: string;
    total_entries: number;
    properties: Array<{
      id: string;
      name: string;
      type: string;
      units: number;
      manager: string;
    }>;
    sender_types: string[];
    urgency_levels: string[];
  };
  emails: SeedEmail[];
}

// ── Extracted Field (with traffic light) ─────────────────────────────
export interface ExtractedField<T = string> {
  value: T;
  status: TrafficLight;
  confidence: number;
  note?: string;
}

// ── Problem ──────────────────────────────────────────────────────────
export interface Problem {
  id: string;
  title: string;
  description: string;
  status: TrafficLight;
  category: string;
  suggested_action: string | null;
  requires_info: string | null;
}

// ── Source Span (anchors extraction → email text) ────────────────────
export interface SourceSpan {
  /** Which email in the thread (by id) */
  email_id: string;
  /** Exact text snippet from the email body */
  text: string;
  /** Which extraction field or problem this anchors to */
  field: string;
  /** Human-readable label shown on hover */
  label: string;
}

// ── Extraction Result ────────────────────────────────────────────────
export interface Extraction {
  sender_name: ExtractedField<string>;
  sender_type: ExtractedField<SenderType>;
  urgency: ExtractedField<UrgencyLevel>;
  summary: ExtractedField<string>;
  property: ExtractedField<string>;
  problems: Problem[];
  /** Spans linking extracted data back to email text */
  source_spans?: SourceSpan[];
}

// ── Thread Action ────────────────────────────────────────────────────
export interface ThreadAction {
  id: string;
  type: ActionType;
  description: string;
  timestamp: string;
  draft_email: string | null;
  approved: boolean;
}

// ── Thread State ─────────────────────────────────────────────────────
export interface ThreadState {
  thread_id: string;
  status: ThreadStatus;
  extraction: Extraction | null;
  actions: ThreadAction[];
  human_notes: string;
}

// ── Runtime App State (persisted to state.json) ──────────────────────
export interface AppState {
  threads: Record<string, ThreadState>;
  last_updated: string;
}

// ── Analytics Runtime State (persisted to analytics.json) ───────────
export interface SentItem {
  id: string;
  thread_id: string;
  action_id: string;
  action_type: ActionType;
  description: string;
  draft_email: string | null;
  sent_at: string;
  subject: string;
  property_name: string;
  recipient_name: string;
  recipient_email: string;
}

export interface AnalyzedThreadEvent {
  thread_id: string;
  subject: string;
  property_name: string;
  analyzed_at: string;
  overall_health: TrafficLight;
  urgency: UrgencyLevel | null;
}

export interface AnalyticsState {
  last_updated: string;
  sent_items: SentItem[];
  analyzed_threads: AnalyzedThreadEvent[];
}

export interface DashboardSummary {
  generated_at: string;
  totals: {
    threads: number;
    analyzed: number;
    resolved: number;
    sent_actions: number;
  };
  thread_health: Record<TrafficLight, number>;
  thread_status: Record<ThreadStatus, number>;
  problem_status: Record<TrafficLight, number>;
  recent_analyzed: AnalyzedThreadEvent[];
  recent_sent: SentItem[];
}

// ── API Response: Thread Summary (for inbox list) ────────────────────
export interface ThreadSummary {
  thread_id: string;
  subject: string;
  last_email_timestamp: string;
  email_count: number;
  sender_name: string;
  sender_type: string;
  property_name: string;
  status: ThreadStatus;
  urgency: UrgencyLevel | null;
  overall_health: TrafficLight;
  problem_count: number;
  unread_count: number;
}

// ── API Response: Thread Detail ──────────────────────────────────────
export interface ThreadDetail {
  thread_id: string;
  subject: string;
  emails: SeedEmail[];
  state: ThreadState;
  property_name: string;
}
