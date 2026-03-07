import { Link } from "react-router-dom";
import {
  Clock3,
  Loader2,
  MailCheck,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import { useSentQuery } from "@/hooks/useThreads";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatActionType(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSentAt(value: string): string {
  return new Date(value).toLocaleString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Sent() {
  const { data, isLoading } = useSentQuery();
  const sent = data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-border/70 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 font-medium">
                <ShieldCheck className="size-3.5" />
                Tracked in analytics
              </span>
              <span className="flex items-center gap-2 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 font-medium">
                <Clock3 className="size-3.5" />
                {sent[0] ? `Latest: ${formatSentAt(sent[0].sent_at)}` : "No recent activity"}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 pt-5 md:grid-cols-3">
          <Metric title="Total Sent" value={sent.length} icon={Send} />
          <Metric
            title="Latest Activity"
            value={sent[0] ? "Live" : "Idle"}
            note={sent[0] ? formatSentAt(sent[0].sent_at) : "No sent messages yet"}
            icon={MailCheck}
          />
          <Metric
            title="Recipient Log"
            value={sent.length > 0 ? `${new Set(sent.map((item) => item.recipient_email)).size}` : "0"}
            note="Unique recipients"
            icon={User}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Sent Timeline</CardTitle>
          <CardDescription>Newest first, with direct access back to each thread.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading sent items...
            </div>
          ) : sent.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 text-sm text-muted-foreground">
              No approved sends yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sent.map((item) => (
                <article key={item.id} className="app-surface-muted px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                          {formatActionType(item.action_type)}
                        </span>
                        <span className="text-muted-foreground">{formatSentAt(item.sent_at)}</span>
                        <span className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1 text-muted-foreground">
                          {item.property_name}
                        </span>
                      </div>

                      <p className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">
                        {item.subject}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="size-3.5" />
                        {item.recipient_name} · {item.recipient_email}
                      </p>

                      {item.draft_email && (
                        <div className="mt-3 rounded-xl border border-border/70 bg-white/70 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                          {item.draft_email}
                        </div>
                      )}
                    </div>

                    <Button size="xs" variant="outline" asChild>
                      <Link to={`/thread/${item.thread_id}`}>Open thread</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  note?: string;
  icon: typeof Send;
}) {
  return (
    <div className="app-stat">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{value}</p>
          {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
        </div>
        <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
