import { Link } from "react-router-dom";
import { Loader2, MailCheck, Send, User } from "lucide-react";
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
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="size-4 text-emerald-600" />
            Sent Messages
          </CardTitle>
          <CardDescription>
            Approved outbound responses tracked from simulated workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs text-muted-foreground">Total sent</p>
            <p className="mt-1 text-2xl font-semibold">{sent.length}</p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs text-muted-foreground">Latest activity</p>
            <p className="mt-1 text-sm font-medium">
              {sent[0] ? formatSentAt(sent[0].sent_at) : "No sent messages yet"}
            </p>
          </div>
          <div className="rounded-xl border bg-background p-3">
            <p className="text-xs text-muted-foreground">Tracked by</p>
            <p className="mt-1 text-sm font-medium">analytics.json</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Sent Timeline</CardTitle>
          <CardDescription>Newest first. Open a thread to inspect full context.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading sent items...
            </div>
          ) : sent.length === 0 ? (
            <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
              No approved sends yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sent.map((item) => (
                <article key={item.id} className="rounded-2xl border bg-background p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                      <Send className="mr-1 size-3" />
                      {formatActionType(item.action_type)}
                    </span>
                    <span className="text-muted-foreground">{formatSentAt(item.sent_at)}</span>
                    <span className="text-muted-foreground">{item.property_name}</span>
                  </div>
                  <p className="text-sm font-semibold">{item.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  <p className="mt-2 inline-flex items-center text-xs text-muted-foreground">
                    <User className="mr-1 size-3" />
                    {item.recipient_name} · {item.recipient_email}
                  </p>
                  {item.draft_email && (
                    <p className="mt-3 max-h-24 overflow-hidden rounded-xl border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      {item.draft_email}
                    </p>
                  )}
                  <div className="mt-3">
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
