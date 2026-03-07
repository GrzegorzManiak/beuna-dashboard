import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Send,
  Shield,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadDetail } from "@shared/types";

interface TimelineEvent {
  id: string;
  timestamp: string;
  icon: typeof Zap;
  iconColor: string;
  dotColor: string;
  title: string;
  subtitle?: string;
  auto?: boolean;
}

function buildTimeline(thread: ThreadDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const firstEmail = thread.emails[0];

  if (firstEmail) {
    events.push({
      id: "received",
      timestamp: firstEmail.timestamp,
      icon: Clock,
      iconColor: "text-slate-500",
      dotColor: "bg-slate-400",
      title: "Email received",
      subtitle: `From ${firstEmail.from.name}`,
    });
  }

  if (thread.state.extraction) {
    const analyzeTime = thread.state.actions[0]?.timestamp ?? firstEmail?.timestamp ?? "";
    events.push({
      id: "analyzed",
      timestamp: analyzeTime,
      icon: Zap,
      iconColor: "text-blue-600",
      dotColor: "bg-blue-500",
      title: "Thread analyzed",
      subtitle: `${thread.state.extraction.problems.length} problem${thread.state.extraction.problems.length !== 1 ? "s" : ""} found`,
    });
  }

  for (const action of thread.state.actions) {
    const typeLabels: Record<string, string> = {
      acknowledge: "Acknowledgement",
      request_info: "Info request",
      maintenance_request: "Maintenance request",
      contractor_dispatch: "Contractor dispatch",
      escalate: "Escalation",
      forward_to_human: "Support escalation",
      reply: "Reply",
    };

    const label = typeLabels[action.type] ?? action.type.replace(/_/g, " ");

    if (action.auto_triggered && !action.approved) {
      events.push({
        id: `action-draft-${action.id}`,
        timestamp: action.timestamp,
        icon: Bot,
        iconColor: "text-amber-600",
        dotColor: "bg-amber-500",
        title: `Draft prepared`,
        subtitle: `${label} awaiting approval`,
        auto: true,
      });
    } else if (action.approved) {
      events.push({
        id: `action-sent-${action.id}`,
        timestamp: action.timestamp,
        icon: action.type === "forward_to_human" ? User : Send,
        iconColor: "text-emerald-600",
        dotColor: "bg-emerald-500",
        title: `${label} sent`,
        subtitle: action.auto_triggered ? "Auto-approved" : "Manually approved",
        auto: action.auto_triggered,
      });
    } else {
      events.push({
        id: `action-pending-${action.id}`,
        timestamp: action.timestamp,
        icon: ArrowRight,
        iconColor: "text-slate-400",
        dotColor: "bg-slate-300",
        title: label,
        subtitle: "Queued",
      });
    }
  }

  if (thread.state.status === "in_progress") {
    events.push({
      id: "in-progress",
      timestamp: new Date().toISOString(),
      icon: Shield,
      iconColor: "text-violet-600",
      dotColor: "bg-violet-500",
      title: "In progress",
      subtitle: "Responses are being processed",
    });
  }

  if (thread.state.status === "resolved") {
    events.push({
      id: "resolved",
      timestamp: new Date().toISOString(),
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      dotColor: "bg-emerald-600",
      title: "Resolved",
      subtitle: "Thread can be closed",
    });
  }

  const redCount = thread.state.extraction?.problems.filter((problem) => problem.status === "red").length ?? 0;
  if (redCount > 0) {
    events.push({
      id: "blocked",
      timestamp: new Date().toISOString(),
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      dotColor: "bg-rose-500",
      title: `${redCount} blocked item${redCount !== 1 ? "s" : ""}`,
      subtitle: "Needs human judgment",
    });
  }

  return events.sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function HistoryPanel({ thread }: { thread: ThreadDetail }) {
  const events = buildTimeline(thread);

  return (
    <div className="app-surface flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 px-4 py-4">
        <span className="app-kicker">History</span>
        <p className="mt-3 text-sm font-semibold tracking-[-0.01em]">Thread activity</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          The most recent operational events for this thread.
        </p>
      </div>

      <div className="app-scroll flex-1 overflow-y-auto px-4 py-4">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-border/80 bg-background/40 text-sm text-muted-foreground">
            No activity yet.
          </div>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/80" />

            <div className="space-y-3">
              {events.map((event) => {
                const Icon = event.icon;
                return (
                  <div key={event.id} className="relative flex items-start gap-3">
                    <div className="absolute -left-4 top-3 flex size-4 items-center justify-center rounded-full bg-white ring-4 ring-white">
                      <span className={cn("block size-2 rounded-full", event.dotColor)} />
                    </div>

                    <article className="w-full rounded-[16px] border border-border/70 bg-white/70 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("size-3.5 shrink-0", event.iconColor)} />
                            <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">
                              {event.title}
                            </p>
                          </div>
                          {event.subtitle && (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {event.auto && <Bot className="size-3 opacity-60" />}
                              {event.subtitle}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
