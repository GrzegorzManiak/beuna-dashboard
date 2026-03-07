import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useDashboardQuery } from "@/hooks/useThreads";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatStamp(value: string): string {
  return new Date(value).toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUrgency(value: string | null): string {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function Dashboard() {
  const { data, isLoading } = useDashboardQuery();

  if (isLoading || !data) {
    return (
      <div className="app-surface flex h-44 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-border/70 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 font-medium">
                <span className="size-2 rounded-full bg-primary" />
                Updated {formatStamp(data.generated_at)}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                <ShieldCheck className="size-3.5" />
                Analytics synced
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Threads" value={data.totals.threads} icon={Mail} />
          <Metric title="Analyzed" value={data.totals.analyzed} icon={CheckCircle2} />
          <Metric title="Resolved" value={data.totals.resolved} icon={ShieldCheck} tone="positive" />
          <Metric title="Sent Actions" value={data.totals.sent_actions} icon={Send} tone="accent" />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatusCard
          title="Thread Health"
          description="Overall extraction confidence per thread."
          values={[
            { label: "Green", value: data.thread_health.green, tone: "green" },
            { label: "Orange", value: data.thread_health.orange, tone: "orange" },
            { label: "Red", value: data.thread_health.red, tone: "red" },
          ]}
        />
        <StatusCard
          title="Problem Health"
          description="Issue-level review distribution."
          values={[
            { label: "Green", value: data.problem_status.green, tone: "green" },
            { label: "Orange", value: data.problem_status.orange, tone: "orange" },
            { label: "Red", value: data.problem_status.red, tone: "red" },
          ]}
        />
        <StatusCard
          title="Workflow Status"
          description="Current stage across the queue."
          values={[
            { label: "Pending", value: data.thread_status.pending, tone: "neutral" },
            { label: "Analyzed", value: data.thread_status.analyzed, tone: "neutral" },
            { label: "Reviewing", value: data.thread_status.reviewing, tone: "neutral" },
            { label: "In Progress", value: data.thread_status.in_progress, tone: "accent" },
            { label: "Resolved", value: data.thread_status.resolved, tone: "green" },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Recent Analyzed Threads</CardTitle>
            <CardDescription>Latest thread intelligence captured in analytics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {data.recent_analyzed.length === 0 ? (
              <EmptyState text="No analyzed thread activity yet." />
            ) : (
              data.recent_analyzed.map((item) => (
                <article key={item.thread_id} className="app-surface-muted px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold tracking-[-0.01em]">{item.subject}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1">
                          {item.property_name}
                        </span>
                        <span className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1">
                          {formatUrgency(item.urgency)}
                        </span>
                        <span>{formatStamp(item.analyzed_at)}</span>
                      </div>
                    </div>

                    <Button size="xs" variant="outline" asChild>
                      <Link to={`/thread/${item.thread_id}`}>
                        Open
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Recent Sent Actions</CardTitle>
            <CardDescription>Approved outbound communications from the workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {data.recent_sent.length === 0 ? (
              <EmptyState text="No sent actions yet." />
            ) : (
              data.recent_sent.map((item) => (
                <article key={item.id} className="app-surface-muted px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold tracking-[-0.01em]">{item.subject}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                          {item.action_type.replace(/_/g, " ")}
                        </span>
                        <span>{item.recipient_name}</span>
                        <span>{formatStamp(item.sent_at)}</span>
                      </div>
                    </div>

                    <Button size="xs" variant="outline" asChild>
                      <Link to={`/thread/${item.thread_id}`}>
                        Open
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: number;
  icon: typeof Mail;
  tone?: "neutral" | "positive" | "accent";
}) {
  const iconTone =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "accent"
        ? "bg-violet-50 text-violet-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="app-stat">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
        </div>
        <div className={cn("rounded-lg p-2.5", iconTone)}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  description,
  values,
}: {
  title: string;
  description: string;
  values: Array<{ label: string; value: number; tone: "green" | "orange" | "red" | "neutral" | "accent" }>;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-5">
        {values.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-xl border border-border/70 bg-white/70 px-3.5 py-3"
          >
            <span className="flex items-center gap-2 text-sm">
              <StatusPill tone={item.tone} />
              {item.label}
            </span>
            <span className="font-semibold tabular-nums">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatusPill({
  tone,
}: {
  tone: "green" | "orange" | "red" | "neutral" | "accent";
}) {
  const className =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "orange"
        ? "bg-amber-500"
        : tone === "red"
          ? "bg-rose-500 animate-slow-pulse"
          : tone === "accent"
            ? "bg-violet-500"
            : "bg-slate-400";

  return <span className={cn("inline-block size-2.5 rounded-full", className)} />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 text-sm text-muted-foreground">
      <AlertTriangle className="mr-2 size-4" />
      {text}
    </div>
  );
}
