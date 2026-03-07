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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAnalyzeAll, useHealthQuery, useThreadsQuery } from "@/hooks/useThreads";
import { cn } from "@/lib/utils";
import type { ThreadStatus, ThreadSummary, UrgencyLevel } from "@shared/types";

type FilterStatus = "all" | ThreadStatus;

const urgencyConfig: Record<
  UrgencyLevel,
  { label: string; color: string; icon: typeof AlertTriangle }
> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  high: { label: "High", color: "bg-orange-100 text-orange-700", icon: Clock },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700", icon: Mail },
  low: { label: "Low", color: "bg-slate-100 text-slate-700", icon: Mail },
};

const statusStyles: Record<ThreadStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  analyzed: "bg-cyan-100 text-cyan-700",
  reviewing: "bg-amber-100 text-amber-700",
  in_progress: "bg-violet-100 text-violet-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

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

  const blockers =
    threads?.filter((thread) => thread.overall_health === "red").length ?? 0;
  const analyzed =
    threads?.filter((thread) => thread.status !== "pending").length ?? 0;

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
        <Card className="border-red-200 bg-red-50/80">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-red-800">
            <WifiOff className="size-4 shrink-0" />
            <p>OpenRouter is disconnected. Analysis is running in mock mode.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-4 text-cyan-700" />
                Inbox Triage
              </CardTitle>
              <CardDescription>
                Analyze threads, resolve blockers, and dispatch replies.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => analyzeAll.mutate()}
                disabled={analyzeAll.isPending}
              >
                {analyzeAll.isPending ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Zap className="mr-1.5 size-4" />
                )}
                {analyzeAll.isPending ? "Analyzing..." : "Analyze All"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={resetting}
              >
                <RefreshCcw className={cn("size-4", resetting && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total threads" value={counts.all} />
          <MetricCard label="Analyzed" value={analyzed} />
          <MetricCard label="Blocked (red)" value={blockers} tone="danger" />
          <MetricCard label="Resolved" value={counts.resolved} tone="ok" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by subject, sender, property"
                className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
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
                    "rounded-xl px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {formatStatusLabel(value)} ({counts[value]})
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading inbox...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <CheckCircle2 className="mr-2 size-4" />
              No threads match your filters.
            </div>
          ) : (
            <div className="space-y-2">
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

        <CardContent className="border-t pt-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>{threads?.length ?? 0} threads</span>
            <span>{blockers} need attention</span>
            {analyzeAll.data && (
              <span className="text-emerald-600">
                Last batch: {analyzeAll.data.completed} analyzed,{" "}
                {analyzeAll.data.failed} failed
              </span>
            )}
          </div>
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
  const urgency = thread.urgency ? urgencyConfig[thread.urgency] : null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full rounded-2xl border bg-background px-4 py-3 text-left transition-all",
        "hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-sm",
        thread.unread_count > 0 && "border-cyan-200/80 bg-cyan-50/30"
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <StatusDot status={thread.overall_health} size="sm" />
        <p className="text-sm font-semibold">{thread.sender_name}</p>
        {thread.property_name !== "Unknown" && (
          <span className="text-xs text-muted-foreground">{thread.property_name}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatRelativeTime(thread.last_email_timestamp)}
        </span>
      </div>

      <p
        className={cn(
          "text-sm",
          thread.unread_count > 0 ? "font-semibold" : "text-foreground"
        )}
      >
        {thread.subject}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={cn("rounded-full px-2 py-0.5 font-medium", statusStyles[thread.status])}
        >
          {formatStatusLabel(thread.status)}
        </span>
        {urgency && (
          <span
            className={cn("rounded-full px-2 py-0.5 font-medium", urgency.color)}
          >
            {urgency.label}
          </span>
        )}
        {thread.problem_count > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {thread.problem_count} problem{thread.problem_count === 1 ? "" : "s"}
          </span>
        )}
        {thread.unread_count > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
            {thread.unread_count} unread
          </span>
        )}
      </div>
    </button>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "danger" | "ok";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "ok"
        ? "text-emerald-700"
        : "text-foreground";

  return (
    <div className="rounded-2xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", toneClass)}>{value}</p>
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
  return value.charAt(0).toUpperCase() + value.slice(1);
}
