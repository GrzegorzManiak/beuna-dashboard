import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Send,
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

function formatStamp(value: string): string {
  return new Date(value).toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUrgency(value: string | null): string {
  if (!value) return "unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function Dashboard() {
  const { data, isLoading } = useDashboardQuery();

  if (isLoading || !data) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border bg-card text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Clock3 className="size-4 text-cyan-700" />
            Current Situation
          </CardTitle>
          <CardDescription>
            Updated {formatStamp(data.generated_at)} from live thread state + analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Threads" value={data.totals.threads} icon={Mail} />
          <Metric title="Analyzed" value={data.totals.analyzed} icon={CheckCircle2} />
          <Metric title="Resolved" value={data.totals.resolved} icon={CheckCircle2} />
          <Metric title="Sent actions" value={data.totals.sent_actions} icon={Send} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatusCard
          title="Thread Health"
          values={[
            { label: "Green", value: data.thread_health.green, tone: "green" },
            { label: "Orange", value: data.thread_health.orange, tone: "orange" },
            { label: "Red", value: data.thread_health.red, tone: "red" },
          ]}
        />
        <StatusCard
          title="Problem Health"
          values={[
            { label: "Green", value: data.problem_status.green, tone: "green" },
            { label: "Orange", value: data.problem_status.orange, tone: "orange" },
            { label: "Red", value: data.problem_status.red, tone: "red" },
          ]}
        />
        <StatusCard
          title="Workflow Status"
          values={[
            { label: "Pending", value: data.thread_status.pending, tone: "neutral" },
            { label: "Analyzed", value: data.thread_status.analyzed, tone: "neutral" },
            { label: "Reviewing", value: data.thread_status.reviewing, tone: "neutral" },
            { label: "Resolved", value: data.thread_status.resolved, tone: "neutral" },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Recent Analyzed Threads</CardTitle>
            <CardDescription>Latest AI analyses captured in analytics.json</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.recent_analyzed.length === 0 ? (
              <EmptyState text="No analyzed thread activity yet." />
            ) : (
              data.recent_analyzed.map((item) => (
                <article key={item.thread_id} className="rounded-2xl border bg-background p-3">
                  <p className="text-sm font-semibold">{item.subject}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.property_name}</span>
                    <span>·</span>
                    <span>{formatUrgency(item.urgency)}</span>
                    <span>·</span>
                    <span>{formatStamp(item.analyzed_at)}</span>
                  </div>
                  <div className="mt-2">
                    <Button size="xs" variant="outline" asChild>
                      <Link to={`/thread/${item.thread_id}`}>Open thread</Link>
                    </Button>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Recent Sent Actions</CardTitle>
            <CardDescription>Approved outbound mock emails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.recent_sent.length === 0 ? (
              <EmptyState text="No sent actions yet." />
            ) : (
              data.recent_sent.map((item) => (
                <article key={item.id} className="rounded-2xl border bg-background p-3">
                  <p className="text-sm font-semibold">{item.subject}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.action_type.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{item.recipient_name}</span>
                    <span>·</span>
                    <span>{formatStamp(item.sent_at)}</span>
                  </div>
                  <div className="mt-2">
                    <Button size="xs" variant="outline" asChild>
                      <Link to={`/thread/${item.thread_id}`}>Open thread</Link>
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
}: {
  title: string;
  value: number;
  icon: typeof Mail;
}) {
  return (
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{title}</span>
        <Icon className="size-3.5" />
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusCard({
  title,
  values,
}: {
  title: string;
  values: Array<{ label: string; value: number; tone: "green" | "orange" | "red" | "neutral" }>;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-4">
        {values.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
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

function StatusPill({ tone }: { tone: "green" | "orange" | "red" | "neutral" }) {
  const className =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "orange"
        ? "bg-amber-500"
        : tone === "red"
          ? "bg-red-500 animate-pulse"
          : "bg-slate-400";
  return <span className={`inline-block size-2.5 rounded-full ${className}`} />;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
      <AlertTriangle className="mr-2 size-4" />
      {text}
    </div>
  );
}
