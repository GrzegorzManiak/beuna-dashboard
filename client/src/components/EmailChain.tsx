import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Paperclip,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SeedEmail, SourceSpan, ThreadAction, TrafficLight } from "@shared/types";

const statusTones: Record<
  TrafficLight,
  { bg: string; border: string; text: string; active: string }
> = {
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    active: "shadow-[0_0_0_3px_rgba(16,185,129,0.14)]",
  },
  orange: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    active: "shadow-[0_0_0_3px_rgba(245,158,11,0.16)]",
  },
  red: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-900",
    active: "shadow-[0_0_0_3px_rgba(244,63,94,0.14)]",
  },
};

const neutralTone = {
  bg: "bg-slate-50",
  border: "border-slate-200",
  text: "text-slate-900",
  active: "shadow-[0_0_0_3px_rgba(100,116,139,0.12)]",
};

function getHighlightTone(status?: TrafficLight) {
  if (!status) return neutralTone;
  return statusTones[status];
}

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

  matches.sort((left, right) => left.start - right.start);
  const deduped: typeof matches = [];
  for (const match of matches) {
    const last = deduped[deduped.length - 1];
    if (!last || match.start >= last.end) deduped.push(match);
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of deduped) {
    if (match.start > cursor) {
      segments.push({ text: body.substring(cursor, match.start), span: null });
    }
    segments.push({
      text: body.substring(match.start, match.end),
      span: match.span,
    });
    cursor = match.end;
  }
  if (cursor < body.length) segments.push({ text: body.substring(cursor), span: null });
  return segments;
}

function HighlightedBody({
  body,
  emailId,
  spans,
  fieldStatuses,
  activeField,
  onSpanClick,
}: {
  body: string;
  emailId: string;
  spans: SourceSpan[];
  fieldStatuses: Record<string, TrafficLight>;
  activeField: string | null;
  onSpanClick: (field: string) => void;
}) {
  const emailSpans = useMemo(
    () => spans.filter((span) => span.email_id === emailId),
    [spans, emailId]
  );
  const segments = useMemo(() => buildSegments(body, emailSpans), [body, emailSpans]);

  return (
    <div className="whitespace-pre-wrap text-[13px] leading-7 text-foreground/90">
      {segments.map((segment, index) => {
        if (!segment.span) return <Fragment key={index}>{segment.text}</Fragment>;

        const color = getHighlightTone(fieldStatuses[segment.span.field]);
        const isActive = activeField === segment.span.field;

        return (
          <mark
            key={index}
            role="button"
            tabIndex={0}
            title={segment.span.label}
            onClick={() => onSpanClick(segment.span!.field)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSpanClick(segment.span!.field);
            }}
            className={cn(
              "cursor-pointer rounded-[8px] border px-1 py-0.5 transition-all duration-150",
              color.bg,
              color.border,
              color.text,
              isActive && color.active
            )}
          >
            {segment.text}
          </mark>
        );
      })}
    </div>
  );
}

function EmailMessage({
  email,
  isFirst,
  spans,
  fieldStatuses,
  activeField,
  onSpanClick,
}: {
  email: SeedEmail;
  isFirst: boolean;
  spans: SourceSpan[];
  fieldStatuses: Record<string, TrafficLight>;
  activeField: string | null;
  onSpanClick: (field: string) => void;
}) {
  const isInternal =
    email.from.type === "internal" || email.from.email.endsWith("@manageco.ie");
  const shouldHighlight = !isInternal;

  return (
    <article
      className={cn(
        "rounded-xl border px-4 py-4 shadow-sm",
        isInternal
          ? "border-sky-100 bg-sky-50/70"
          : "border-border/70 bg-white/80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase tracking-[0.08em]",
              isInternal ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700"
            )}
          >
            {email.from.name
              .split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                {email.from.name}
              </p>
              {isInternal && (
                <span className="rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                  Internal
                </span>
              )}
              {email.from.unit && (
                <span className="text-[11px] text-muted-foreground">{email.from.unit}</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              to {email.to}
              {email.cc && <span> · cc {email.cc}</span>}
            </p>
          </div>
        </div>

        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {new Date(email.timestamp).toLocaleString("en-IE", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isFirst && (
        <div className="mt-4 rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Subject
          </p>
          <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.01em]">{email.subject}</h3>
        </div>
      )}

      <div className="mt-4">
        {shouldHighlight ? (
          <HighlightedBody
            body={email.body}
            emailId={email.id}
            spans={spans}
            fieldStatuses={fieldStatuses}
            activeField={activeField}
            onSpanClick={onSpanClick}
          />
        ) : (
          <div className="whitespace-pre-wrap text-[13px] leading-7 text-foreground/85">
            {email.body}
          </div>
        )}
      </div>

      {email.attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {email.attachments.map((attachment) => (
            <span
              key={attachment}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              <Paperclip className="size-3" />
              {attachment}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function SentActionCard({ action }: { action: ThreadAction }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const typeLabels: Record<string, string> = {
    acknowledge: "Acknowledgement sent",
    request_info: "Information requested",
    maintenance_request: "Maintenance request sent",
    contractor_dispatch: "Contractor dispatched",
    escalate: "Escalated to management",
    forward_to_human: "Escalated to human support",
    reply: "Reply sent",
  };

  return (
    <article
      ref={ref}
      style={{ animation: "slideUp 0.4s ease-out" }}
      className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          {action.approved ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold tracking-[-0.01em] text-emerald-900">
                {typeLabels[action.type] ?? action.type.replace(/_/g, " ")}
              </p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
                Approved outbound action
              </p>
            </div>

            <span className="text-[11px] tabular-nums text-emerald-800/70">
              {new Date(action.timestamp).toLocaleTimeString("en-IE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {action.draft_email && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white/70 px-3.5 py-3 text-[12px] leading-6 text-foreground/80">
              {action.draft_email}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function EmailChain({
  emails,
  subject,
  spans,
  fieldStatuses,
  activeField,
  actions,
  onBack,
  onSpanClick,
}: {
  emails: SeedEmail[];
  subject: string;
  spans: SourceSpan[];
  fieldStatuses: Record<string, TrafficLight>;
  activeField: string | null;
  actions: ThreadAction[];
  onBack: () => void;
  onSpanClick: (field: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const approvedActions = actions.filter((action) => action.approved);

  useEffect(() => {
    if (approvedActions.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [approvedActions.length]);

  return (
    <div className="app-surface flex flex-col">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-3">
            <Button size="icon-sm" variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Conversation
              </p>
              <h3 className="mt-1 truncate text-[16px] font-semibold tracking-[-0.02em]">
                {subject}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/80 bg-background px-2.5 py-1">
              {emails.length} email{emails.length === 1 ? "" : "s"}
            </span>
            {spans.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">
                {spans.length} highlights
              </span>
            )}
            {approvedActions.length > 0 && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                {approvedActions.length} sent
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 py-3">
        <div className="mx-auto max-w-3xl space-y-2.5">
          {emails.map((email, index) => (
            <EmailMessage
              key={email.id}
              email={email}
              isFirst={index === 0}
              spans={spans}
              fieldStatuses={fieldStatuses}
              activeField={activeField}
              onSpanClick={onSpanClick}
            />
          ))}

          {approvedActions.map((action) => (
            <SentActionCard key={action.id} action={action} />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
