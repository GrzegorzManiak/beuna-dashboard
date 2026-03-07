import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  WifiOff,
  Zap,
} from "lucide-react";
import { threadsApi } from "@/api/threads";
import { StatusDot } from "@/components/StatusIndicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { useAnalyzeAll, useHealthQuery, useThreadsQuery } from "@/hooks/useThreads";
import { cn } from "@/lib/utils";
import type { ThreadStatus, ThreadSummary, UrgencyLevel } from "@shared/types";

type FilterStatus = "all" | ThreadStatus;

const urgencyConfig: Record<UrgencyLevel, string> = {
  critical: "bg-rose-50 text-rose-700 border-rose-200/80",
  high: "bg-amber-50 text-amber-700 border-amber-200/80",
  medium: "bg-sky-50 text-sky-700 border-sky-200/80",
  low: "bg-slate-100 text-slate-600 border-slate-200/80",
};

const statusStyles: Record<ThreadStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200/80",
  analyzed: "bg-blue-50 text-blue-700 border-blue-200/80",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200/80",
  in_progress: "bg-violet-50 text-violet-700 border-violet-200/80",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
};

const healthStyles = {
  red: "border-rose-200/80 bg-rose-50/70",
  orange: "border-amber-200/80 bg-amber-50/60",
  green: "border-emerald-200/80 bg-emerald-50/50",
} as const;

export function Inbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: threads, isLoading } = useThreadsQuery();
  const { data: health } = useHealthQuery();
  const analyzeAll = useAnalyzeAll();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [resetting, setResetting] = useState(false);

  const rows = (threads ?? []).filter((thread) => {
    if (filter !== "all" && thread.status !== filter) return false;
    if (!search) return true;

    const query = search.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.sender_name.toLowerCase().includes(query) ||
      thread.property_name.toLowerCase().includes(query)
    );
  });

  const counts = {
    all: threads?.length ?? 0,
    pending: threads?.filter((thread) => thread.status === "pending").length ?? 0,
    analyzed: threads?.filter((thread) => thread.status === "analyzed").length ?? 0,
    reviewing: threads?.filter((thread) => thread.status === "reviewing").length ?? 0,
    in_progress:
      threads?.filter((thread) => thread.status === "in_progress").length ?? 0,
    resolved: threads?.filter((thread) => thread.status === "resolved").length ?? 0,
  };

  const blockedCount =
    threads?.filter((thread) => thread.overall_health === "red").length ?? 0;
  const reviewedCount =
    threads?.filter((thread) => thread.status !== "pending").length ?? 0;
  const unreadCount =
    threads?.reduce((total, thread) => total + thread.unread_count, 0) ?? 0;

  async function handleReset() {
    setResetting(true);
    try {
      await threadsApi.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["threads"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["sent"] }),
      ]);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      {health && !health.openrouter_connected && (
        <div className="app-surface flex items-center gap-3 px-4 py-3 text-sm text-amber-900">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <WifiOff className="size-4" />
          </div>
          <div>
            <p className="font-semibold">Mock analysis mode is active.</p>
            <p className="text-xs text-amber-800/80">
              OpenRouter is disconnected, so the workspace is showing simulated AI behavior.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 font-medium">
                <span className="size-2 rounded-full bg-primary" />
                {unreadCount} unread
              </span>
              {analyzeAll.data && (
                <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="size-3.5" />
                  Last batch: {analyzeAll.data.completed} analyzed, {analyzeAll.data.failed} failed
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => analyzeAll.mutate()}
                disabled={analyzeAll.isPending}
              >
                {analyzeAll.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4" />
                )}
                {analyzeAll.isPending ? "Analyzing..." : "Analyze all"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
              >
                <RefreshCcw className={cn("size-4", resetting && "animate-spin")} />
                Reset state
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Threads"
            value={counts.all}
            note="Live inbox volume"
            icon={Mail}
          />
          <MetricCard
            label="Reviewed"
            value={reviewedCount}
            note="Threads touched by AI"
            icon={Zap}
          />
          <MetricCard
            label="Blocked"
            value={blockedCount}
            note="Needs human judgment"
            tone="alert"
            icon={AlertTriangle}
          />
          <MetricCard
            label="Resolved"
            value={counts.resolved}
            note="Ready to close"
            tone="positive"
            icon={CheckCircle2}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sender, subject, or property"
                  className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/10"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "all",
                  "pending",
                  "analyzed",
                  "reviewing",
                  "in_progress",
                  "resolved",
                ] as const
              ).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-semibold tracking-[-0.01em] transition-all",
                    filter === value
                      ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                        : "border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                  )}
                >
                  {formatStatusLabel(value)}
                  <span className="ml-2 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold opacity-80">
                    {counts[value]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {isLoading ? (
            <ListState icon={Loader2} text="Loading inbox threads..." loading />
          ) : rows.length === 0 ? (
            <ListState
              icon={CheckCircle2}
              text="No threads match the active search and filters."
            />
          ) : (
            <div className="space-y-2.5">
              {rows.map((thread) => (
                <ThreadRow
                  key={thread.thread_id}
                  thread={thread}
                  onOpen={() => navigate(`/thread/${thread.thread_id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ThreadRow({
  thread,
  onOpen,
}: {
  thread: ThreadSummary;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full rounded-lg border px-4 py-4 text-left transition-all duration-200",
        "bg-white/70 hover:-translate-y-0.5 hover:bg-white hover:shadow-md",
        healthStyles[thread.overall_health],
        thread.unread_count > 0 && "ring-1 ring-primary/10"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot status={thread.overall_health} size="sm" />
            <p
              className={cn(
                "truncate text-[15px] font-semibold tracking-[-0.01em]",
                thread.unread_count > 0 ? "text-foreground" : "text-foreground/90"
              )}
            >
              {thread.sender_name}
            </p>
            {thread.property_name !== "Unknown" && (
              <span className="rounded-full border border-border/70 bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {thread.property_name}
              </span>
            )}
          </div>

          <p
            className={cn(
              "mt-2 line-clamp-2 text-sm leading-relaxed",
              thread.unread_count > 0 ? "font-semibold text-foreground" : "text-foreground/80"
            )}
          >
            {thread.subject}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold tracking-[-0.01em]",
                statusStyles[thread.status]
              )}
            >
              {formatStatusLabel(thread.status)}
            </span>

            {thread.urgency && (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 font-semibold tracking-[-0.01em]",
                  urgencyConfig[thread.urgency]
                )}
              >
                {capitalize(thread.urgency)}
              </span>
            )}

            {thread.problem_count > 0 && (
              <span className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1 text-muted-foreground">
                {thread.problem_count} problem{thread.problem_count === 1 ? "" : "s"}
              </span>
            )}

            <span className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1 text-muted-foreground">
              {thread.email_count} email{thread.email_count === 1 ? "" : "s"}
            </span>

            {thread.unread_count > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-1 font-semibold text-primary-foreground shadow-sm">
                {thread.unread_count} unread
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground lg:pl-4">
          <Clock className="size-3.5" />
          <span>{formatRelativeTime(thread.last_email_timestamp)}</span>
        </div>
      </div>
    </button>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Mail;
  tone?: "neutral" | "positive" | "alert";
}) {
  const toneStyles =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "alert"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="app-stat">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{note}</p>
        </div>

        <div className={cn("rounded-lg p-2.5", toneStyles)}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function ListState({
  icon: Icon,
  text,
  loading = false,
}: {
  icon: typeof Loader2;
  text: string;
  loading?: boolean;
}) {
  return (
    <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 text-sm text-muted-foreground">
      <Icon className={cn("mb-3 size-5", loading && "animate-spin")} />
      <p>{text}</p>
    </div>
  );
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 60) return `${Math.max(diffMin, 1)}m ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;

  return date.toLocaleDateString("en-IE", { month: "short", day: "numeric" });
}

function formatStatusLabel(value: FilterStatus): string {
  if (value === "all") return "All";
  if (value === "in_progress") return "In Progress";
  return capitalize(value);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
