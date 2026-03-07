import {
  Zap,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Bot,
  User,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadDetail } from "@shared/types";

// ── Timeline event model ─────────────────────────────────────────────
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

  // Thread received
  const firstEmail = thread.emails[0];
  if (firstEmail) {
    events.push({
      id: "received",
      timestamp: firstEmail.timestamp,
      icon: Clock,
      iconColor: "text-gray-500",
      dotColor: "bg-gray-400",
      title: "Email received",
      subtitle: `From ${firstEmail.from.name}`,
    });
  }

  // Analysed (if extraction exists)
  if (thread.state.extraction) {
    const analyzeTime = thread.state.actions[0]?.timestamp ?? firstEmail?.timestamp ?? "";
    events.push({
      id: "analyzed",
      timestamp: analyzeTime,
      icon: Zap,
      iconColor: "text-blue-500",
      dotColor: "bg-blue-500",
      title: "Analysed",
      subtitle: `${thread.state.extraction.problems.length} problem${thread.state.extraction.problems.length !== 1 ? "s" : ""} found`,
    });
  }

  // Each action — show in timeline
  for (const action of thread.state.actions) {
    const typeLabels: Record<string, string> = {
      acknowledge: "Acknowledgement",
      request_info: "Info request",
      maintenance_request: "Maintenance request",
      contractor_dispatch: "Contractor dispatch",
      escalate: "Escalation",
      forward_to_human: "Forwarded to CS agent",
      reply: "Reply",
    };

    const label = typeLabels[action.type] ?? action.type.replace(/_/g, " ");

    if (action.auto_triggered && !action.approved) {
      events.push({
        id: `action-draft-${action.id}`,
        timestamp: action.timestamp,
        icon: Bot,
        iconColor: "text-amber-500",
        dotColor: "bg-amber-400",
        title: `Draft: ${label}`,
        subtitle: "Pending approval",
        auto: true,
      });
    } else if (action.approved) {
      events.push({
        id: `action-sent-${action.id}`,
        timestamp: action.timestamp,
        icon: action.type === "forward_to_human" ? User : Send,
        iconColor: "text-emerald-500",
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
        iconColor: "text-gray-400",
        dotColor: "bg-gray-300",
        title: label,
        subtitle: "Queued",
      });
    }
  }

  // Status events
  if (thread.state.status === "in_progress") {
    events.push({
      id: "in-progress",
      timestamp: new Date().toISOString(),
      icon: Shield,
      iconColor: "text-cyan-500",
      dotColor: "bg-cyan-500",
      title: "In progress",
      subtitle: "Responses being processed",
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
    });
  }

  // Red items warning
  const redCount = thread.state.extraction?.problems.filter(p => p.status === "red").length ?? 0;
  if (redCount > 0) {
    events.push({
      id: "blocked",
      timestamp: new Date().toISOString(),
      icon: AlertTriangle,
      iconColor: "text-red-500",
      dotColor: "bg-red-500",
      title: `${redCount} blocked item${redCount !== 1 ? "s" : ""}`,
      subtitle: "Needs human judgment",
    });
  }

  return events;
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

// ── HistoryPanel ─────────────────────────────────────────────────────
export function HistoryPanel({ thread }: { thread: ThreadDetail }) {
  const events = buildTimeline(thread);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-3 py-2.5 border-b border-border">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {events.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-8">
            No activity yet
          </p>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-3">
              {events.map((event) => {
                const Icon = event.icon;
                return (
                  <div key={event.id} className="flex items-start gap-2.5 relative">
                    {/* Dot */}
                    <div className={cn(
                      "size-[15px] rounded-full flex items-center justify-center shrink-0 z-10 bg-white ring-2 ring-white",
                    )}>
                      <div className={cn("size-[9px] rounded-full", event.dotColor)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 -mt-0.5">
                      <div className="flex items-center gap-1">
                        <Icon className={cn("size-3 shrink-0", event.iconColor)} />
                        <span className="text-[11px] font-medium truncate">{event.title}</span>
                      </div>
                      {event.subtitle && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          {event.auto && <Bot className="size-2.5 opacity-50" />}
                          {event.subtitle}
                        </p>
                      )}
                      <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
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
