import { useMemo, useEffect, useRef, Fragment } from "react";
import { Mail, Paperclip, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeedEmail, SourceSpan, ThreadAction } from "@shared/types";

// ── Highlight colours per field category ─────────────────────────────
const fieldColors: Record<string, { bg: string; border: string; text: string }> = {
  sender_name: { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-900" },
  sender_type: { bg: "bg-violet-50", border: "border-violet-300", text: "text-violet-900" },
  urgency:     { bg: "bg-rose-50",   border: "border-rose-300",   text: "text-rose-900" },
  property:    { bg: "bg-sky-50",    border: "border-sky-300",    text: "text-sky-900" },
  default:     { bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-900" },
};

function getFieldColor(field: string) {
  if (field.startsWith("prob_")) return fieldColors.default;
  return fieldColors[field] ?? fieldColors.default;
}

// ── Build highlighted segments ───────────────────────────────────────
interface Segment {
  text: string;
  span: SourceSpan | null;
}

function buildSegments(body: string, spans: SourceSpan[]): Segment[] {
  if (spans.length === 0) return [{ text: body, span: null }];

  const matches: Array<{ start: number; end: number; span: SourceSpan }> = [];
  for (const span of spans) {
    const idx = body.indexOf(span.text);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + span.text.length, span });
    }
  }

  matches.sort((a, b) => a.start - b.start);
  const deduped: typeof matches = [];
  for (const m of matches) {
    const last = deduped[deduped.length - 1];
    if (!last || m.start >= last.end) deduped.push(m);
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of deduped) {
    if (m.start > cursor) segments.push({ text: body.substring(cursor, m.start), span: null });
    segments.push({ text: body.substring(m.start, m.end), span: m.span });
    cursor = m.end;
  }
  if (cursor < body.length) segments.push({ text: body.substring(cursor), span: null });
  return segments;
}

// ── Highlighted email body ───────────────────────────────────────────
function HighlightedBody({
  body,
  emailId,
  spans,
  activeField,
  onSpanClick,
}: {
  body: string;
  emailId: string;
  spans: SourceSpan[];
  activeField: string | null;
  onSpanClick: (field: string) => void;
}) {
  const emailSpans = useMemo(
    () => spans.filter((s) => s.email_id === emailId),
    [spans, emailId],
  );
  const segments = useMemo(
    () => buildSegments(body, emailSpans),
    [body, emailSpans],
  );

  return (
    <div className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
      {segments.map((seg, i) => {
        if (!seg.span) return <Fragment key={i}>{seg.text}</Fragment>;
        const color = getFieldColor(seg.span.field);
        const isActive = activeField === seg.span.field;
        return (
          <mark
            key={i}
            role="button"
            tabIndex={0}
            title={seg.span.label}
            onClick={() => onSpanClick(seg.span!.field)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSpanClick(seg.span!.field);
            }}
            className={cn(
              "cursor-pointer border-b-2 px-px -mx-px transition-colors duration-150",
              color.bg,
              color.border,
              color.text,
              isActive && "border-b-[3px] font-medium",
            )}
          >
            {seg.text}
          </mark>
        );
      })}
    </div>
  );
}

// ── Single email message ─────────────────────────────────────────────
function EmailMessage({
  email,
  isFirst,
  spans,
  activeField,
  onSpanClick,
}: {
  email: SeedEmail;
  isFirst: boolean;
  spans: SourceSpan[];
  activeField: string | null;
  onSpanClick: (field: string) => void;
}) {
  const isInternal =
    email.from.type === "internal" || email.from.email.endsWith("@manageco.ie");

  // Only highlight external / inbound emails — never our own outbound
  const shouldHighlight = !isInternal;

  return (
    <div
      className={cn(
        "border-b border-border/50 last:border-b-0",
        isInternal ? "bg-slate-50/60" : "bg-white",
      )}
    >
      <div className="px-5 py-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "size-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                isInternal
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600",
              )}
            >
              {email.from.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold truncate">{email.from.name}</span>
                {isInternal && (
                  <span className="text-[10px] text-blue-600 font-medium">internal</span>
                )}
                {email.from.unit && (
                  <span className="text-[10px] text-muted-foreground">{email.from.unit}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                to {email.to}
                {email.cc && <span> · cc {email.cc}</span>}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums pt-0.5">
            {new Date(email.timestamp).toLocaleString("en-IE", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Subject — only first email */}
        {isFirst && (
          <h3 className="text-[13px] font-semibold mb-2 ml-[38px]">{email.subject}</h3>
        )}

        {/* Body */}
        <div className="ml-[38px]">
          {shouldHighlight ? (
            <HighlightedBody
              body={email.body}
              emailId={email.id}
              spans={spans}
              activeField={activeField}
              onSpanClick={onSpanClick}
            />
          ) : (
            <div className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {email.body}
            </div>
          )}
        </div>

        {/* Attachments */}
        {email.attachments.length > 0 && (
          <div className="ml-[38px] mt-2 flex flex-wrap gap-1">
            {email.attachments.map((att) => (
              <span
                key={att}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/50"
              >
                <Paperclip className="size-2.5" />
                {att}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sent action card (slides up at bottom of chain) ──────────────────
function SentActionCard({ action }: { action: ThreadAction }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, []);

  const typeLabels: Record<string, string> = {
    acknowledge: "Acknowledgement sent",
    request_info: "Information requested",
    maintenance_request: "Maintenance request sent",
    contractor_dispatch: "Contractor dispatched",
    escalate: "Escalated to management",
    reply: "Reply sent",
  };

  return (
    <div
      ref={ref}
      style={{ animation: "slideUp 0.4s ease-out" }}
      className="border-b border-border/50 last:border-b-0"
    >
      <div className="px-5 py-3.5 bg-emerald-50/40">
        <div className="flex items-start gap-2.5">
          <div className="size-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            {action.approved ? (
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            ) : (
              <Send className="size-3.5 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-emerald-800">
                  {typeLabels[action.type] ?? action.type.replace(/_/g, " ")}
                </span>
                {action.approved && (
                  <span className="text-[10px] text-emerald-600 font-medium">sent</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {new Date(action.timestamp).toLocaleString("en-IE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {action.draft_email && (
              <div className="text-[12px] text-foreground/70 whitespace-pre-wrap leading-relaxed mt-1 border-l-2 border-emerald-200 pl-3">
                {action.draft_email}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Email chain ──────────────────────────────────────────────────────
export function EmailChain({
  emails,
  subject,
  spans,
  activeField,
  actions,
  onBack,
  onSpanClick,
}: {
  emails: SeedEmail[];
  subject: string;
  spans: SourceSpan[];
  activeField: string | null;
  actions: ThreadAction[];
  onBack: () => void;
  onSpanClick: (field: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const approvedActions = actions.filter((a) => a.approved);

  // Scroll to bottom when new approved actions come in
  useEffect(() => {
    if (approvedActions.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [approvedActions.length]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Thread header */}
      <div className="px-5 py-3 border-b border-border flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold truncate">{subject}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              {emails.length} email{emails.length > 1 ? "s" : ""}
            </span>
            {spans.length > 0 && (
              <span className="text-[10px] text-violet-600 font-medium">
                {spans.length} highlights
              </span>
            )}
          </div>
        </div>
        <Mail className="size-4 text-muted-foreground" />
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {emails.map((email, i) => (
          <EmailMessage
            key={email.id}
            email={email}
            isFirst={i === 0}
            spans={spans}
            activeField={activeField}
            onSpanClick={onSpanClick}
          />
        ))}

        {/* Approved/sent actions slide in at the bottom */}
        {approvedActions.map((action) => (
          <SentActionCard key={action.id} action={action} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
