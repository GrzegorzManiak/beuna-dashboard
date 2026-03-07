import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Zap,
  Search,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/StatusIndicator";
import { useThreadsQuery, useAnalyzeAll } from "@/hooks/useThreads";
import { threadsApi } from "@/api/threads";
import { cn } from "@/lib/utils";
import type { ThreadSummary, UrgencyLevel, ThreadStatus } from "@shared/types";

const urgencyConfig: Record<
  UrgencyLevel,
  { label: string; color: string; icon: typeof AlertTriangle }
> = {
  critical: { label: "Critical", color: "text-red-600 bg-red-50", icon: AlertTriangle },
  high: { label: "High", color: "text-orange-600 bg-orange-50", icon: Clock },
  medium: { label: "Medium", color: "text-blue-600 bg-blue-50", icon: Mail },
  low: { label: "Low", color: "text-gray-600 bg-gray-50", icon: Mail },
};

const statusConfig: Record<ThreadStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  analyzed: { label: "Analyzed", color: "bg-blue-100 text-blue-700" },
  reviewing: { label: "In Review", color: "bg-amber-100 text-amber-700" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700" },
};

function ThreadRow({
  thread,
  onClick,
}: {
  thread: ThreadSummary;
  onClick: () => void;
}) {
  const urgency = thread.urgency
    ? urgencyConfig[thread.urgency]
    : urgencyConfig.medium;
  const status = statusConfig[thread.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-4 border-b border-border hover:bg-muted/50 transition-colors",
        "flex items-start gap-4",
        thread.unread_count > 0 && "bg-blue-50/30"
      )}
    >
      {/* Status dot */}
      <div className="pt-1.5">
        <StatusDot status={thread.overall_health} size="md" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "font-semibold text-sm truncate",
              thread.unread_count > 0 ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {thread.sender_name}
          </span>
          {thread.unread_count > 0 && (
            <span className="shrink-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full size-4 flex items-center justify-center">
              {thread.unread_count}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {formatTime(thread.last_email_timestamp)}
          </span>
        </div>

        <p
          className={cn(
            "text-sm truncate mb-1.5",
            thread.unread_count > 0
              ? "font-medium text-foreground"
              : "text-muted-foreground"
          )}
        >
          {thread.subject}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Urgency badge */}
          {thread.urgency && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                urgency.color
              )}
            >
              <urgency.icon className="size-3" />
              {urgency.label}
            </span>
          )}

          {/* Status badge */}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              status.color
            )}
          >
            {status.label}
          </span>

          {/* Property */}
          {thread.property_name !== "Unknown" && (
            <span className="text-[11px] text-muted-foreground">
              {thread.property_name}
            </span>
          )}

          {/* Problem count */}
          {thread.problem_count > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {thread.problem_count} problem{thread.problem_count > 1 ? "s" : ""}
            </span>
          )}

          {/* Email count */}
          {thread.email_count > 1 && (
            <span className="text-[11px] text-muted-foreground">
              {thread.email_count} emails
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

type FilterStatus = "all" | "pending" | "analyzed" | "reviewing" | "resolved";

export function Inbox() {
  const navigate = useNavigate();
  const { data: threads, isLoading, refetch } = useThreadsQuery();
  const analyzeAll = useAnalyzeAll();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [resetting, setResetting] = useState(false);

  const filtered = (threads ?? []).filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.sender_name.toLowerCase().includes(q) ||
        t.property_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: threads?.length ?? 0,
    pending: threads?.filter((t) => t.status === "pending").length ?? 0,
    analyzed: threads?.filter((t) => t.status === "analyzed").length ?? 0,
    reviewing: threads?.filter((t) => t.status === "reviewing").length ?? 0,
    resolved: threads?.filter((t) => t.status === "resolved").length ?? 0,
  };

  async function handleReset() {
    setResetting(true);
    try {
      await threadsApi.reset();
      await refetch();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center">
              <Mail className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Inbox</h1>
              <p className="text-xs text-muted-foreground">
                Property Management Email Triage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeAll.mutate()}
              disabled={analyzeAll.isPending}
            >
              {analyzeAll.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Zap className="size-4 mr-1.5" />
              )}
              {analyzeAll.isPending ? "Analyzing..." : "Analyze All"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={resetting}
            >
              <RotateCcw className={cn("size-4", resetting && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search threads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-1">
            {(
              ["all", "pending", "analyzed", "reviewing", "resolved"] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}{" "}
                <span className="opacity-70">({counts[f]})</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading threads...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <CheckCircle2 className="size-8 mb-2" />
            <p className="text-sm">No threads match your filter</p>
          </div>
        ) : (
          filtered.map((thread) => (
            <ThreadRow
              key={thread.thread_id}
              thread={thread}
              onClick={() => navigate(`/thread/${thread.thread_id}`)}
            />
          ))
        )}
      </div>

      {/* Footer stats */}
      <footer className="border-t border-border px-6 py-2 text-xs text-muted-foreground flex items-center gap-4">
        <span>{threads?.length ?? 0} threads</span>
        <span>
          {threads?.filter((t) => t.overall_health === "red").length ?? 0} need
          attention
        </span>
        {analyzeAll.data && (
          <span className="text-emerald-600">
            Last batch: {analyzeAll.data.completed} analyzed, {analyzeAll.data.failed} failed
          </span>
        )}
      </footer>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 1) return `${Math.round(diffMs / (1000 * 60))}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return d.toLocaleDateString("en-IE", { month: "short", day: "numeric" });
}
