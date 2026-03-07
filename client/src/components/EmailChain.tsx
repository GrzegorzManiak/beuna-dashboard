import { useMemo, useCallback, Fragment } from "react";
import { Mail, Paperclip, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeedEmail, SourceSpan, TrafficLight } from "@shared/types";

// ── Highlight colors per field category ──────────────────────────────
const fieldColors: Record<string, { bg: string; ring: string; text: string }> = {
  sender_name: {
    bg: "bg-violet-100/80",
    ring: "ring-violet-300",
    text: "text-violet-900",
  },
  sender_type: {
    bg: "bg-violet-100/80",
    ring: "ring-violet-300",
    text: "text-violet-900",
  },
  urgency: {
    bg: "bg-rose-100/80",
    ring: "ring-rose-300",
    text: "text-rose-900",
  },
  property: {
    bg: "bg-sky-100/80",
    ring: "ring-sky-300",
    text: "text-sky-900",
  },
  default: {
    bg: "bg-amber-100/80",
    ring: "ring-amber-300",
    text: "text-amber-900",
  },
};

function getFieldColor(field: string) {
  if (field.startsWith("prob_")) return fieldColors.default;
  return fieldColors[field] ?? fieldColors.default;
}

// ── Build highlighted segments for one email body ────────────────────
interface Segment {
  text: string;
  span: SourceSpan | null;
}

function buildSegments(body: string, spans: SourceSpan[]): Segment[] {
  if (spans.length === 0) return [{ text: body, span: null }];

  // Find all match positions, sorted by position in text
  const matches: Array<{ start: number; end: number; span: SourceSpan }> = [];
  for (const span of spans) {
    let searchFrom = 0;
    // Find all occurrences, but only use the first
    const idx = body.indexOf(span.text, searchFrom);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + span.text.length, span });
    }
  }

  // Sort by start position, deduplicate overlaps (keep first)
  matches.sort((a, b) => a.start - b.start);
  const deduped: typeof matches = [];
  for (const m of matches) {
    const last = deduped[deduped.length - 1];
    if (!last || m.start >= last.end) {
      deduped.push(m);
    }
  }

  // Build segments
  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of deduped) {
    if (m.start > cursor) {
      segments.push({ text: body.substring(cursor, m.start), span: null });
    }
    segments.push({ text: body.substring(m.start, m.end), span: m.span });
    cursor = m.end;
  }
  if (cursor < body.length) {
    segments.push({ text: body.substring(cursor), span: null });
  }
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
    [spans, emailId]
  );
  const segments = useMemo(
    () => buildSegments(body, emailSpans),
    [body, emailSpans]
  );

  return (
    <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
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
              "cursor-pointer rounded-[3px] px-0.5 -mx-0.5 transition-all duration-200",
              "ring-1 ring-inset hover:ring-2",
              color.bg,
              color.ring,
              color.text,
              isActive && "ring-2 scale-[1.02] brightness-95",
              "hover:brightness-95"
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

  return (
    <div
      className={cn(
        "group rounded-xl border p-4 transition-all duration-200",
        isInternal
          ? "bg-blue-50/40 border-blue-200/60"
          : "bg-white border-border",
        !email.read && "ring-2 ring-primary/15 shadow-sm"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform duration-200 group-hover:scale-105",
              isInternal
                ? "bg-blue-200 text-blue-800"
                : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700"
            )}
          >
            {email.from.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{email.from.name}</span>
              {email.from.unit && (
                <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-medium">
                  {email.from.unit}
                </span>
              )}
              {email.from.type && (
                <span className="text-[11px] text-muted-foreground capitalize font-medium">
                  {email.from.type}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {email.from.email} → {email.to}
              {email.cc && (
                <span className="opacity-70"> · CC: {email.cc}</span>
              )}
            </p>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground shrink-0 font-medium tabular-nums">
          {new Date(email.timestamp).toLocaleString("en-IE", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Subject (only for first in thread) */}
      {isFirst && (
        <h3 className="font-semibold text-sm mb-2.5 text-foreground">
          {email.subject}
        </h3>
      )}

      {/* Body with highlights */}
      <HighlightedBody
        body={email.body}
        emailId={email.id}
        spans={spans}
        activeField={activeField}
        onSpanClick={onSpanClick}
      />

      {/* Attachments */}
      {email.attachments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="flex flex-wrap gap-1.5">
            {email.attachments.map((att) => (
              <span
                key={att}
                className="inline-flex items-center gap-1 text-[11px] bg-gray-50 text-gray-600 px-2 py-1 rounded-md border border-gray-100 font-medium"
              >
                <Paperclip className="size-3 text-gray-400" />
                {att}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Email chain ──────────────────────────────────────────────────────
export function EmailChain({
  emails,
  subject,
  spans,
  activeField,
  onBack,
  onSpanClick,
}: {
  emails: SeedEmail[];
  subject: string;
  spans: SourceSpan[];
  activeField: string | null;
  onBack: () => void;
  onSpanClick: (field: string) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Thread header */}
      <div className="px-5 py-4 border-b border-border bg-white">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <Mail className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            {emails.length} email{emails.length > 1 ? "s" : ""} in thread
          </span>
          {spans.length > 0 && (
            <span className="text-[11px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium border border-violet-100">
              {spans.length} highlights
            </span>
          )}
        </div>
        <h2 className="font-semibold text-lg leading-tight">{subject}</h2>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
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
      </div>
    </div>
  );
}
