import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, WifiOff } from "lucide-react";
import { EmailChain } from "@/components/EmailChain";
import { ExtractionPanel } from "@/components/ExtractionPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { StatusBadge } from "@/components/StatusIndicator";
import { useHealthQuery, useThreadQuery } from "@/hooks/useThreads";
import type { SourceSpan, ThreadDetail, TrafficLight } from "@shared/types";

function getOverallHealth(thread: ThreadDetail): TrafficLight {
  const extraction = thread.state.extraction;
  if (!extraction) return "red";

  const fieldStates = [
    extraction.sender_name.status,
    extraction.sender_type.status,
    extraction.urgency.status,
    extraction.summary.status,
    extraction.property.status,
    ...extraction.problems.map((problem) => problem.status),
  ];

  if (fieldStates.includes("red")) return "red";
  if (fieldStates.includes("orange")) return "orange";
  return "green";
}

function formatStatusLabel(value: string): string {
  if (value === "in_progress") return "In Progress";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ThreadView() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { data: thread, isLoading, isError } = useThreadQuery(threadId);
  const { data: health } = useHealthQuery();

  const [activeField, setActiveField] = useState<string | null>(null);

  const handleSpanClick = useCallback((field: string) => {
    setActiveField(field);
    setTimeout(() => setActiveField((prev) => (prev === field ? null : prev)), 3000);
  }, []);

  const handleFieldClick = useCallback((field: string) => {
    setActiveField((prev) => (prev === field ? null : field));
    setTimeout(() => setActiveField((prev) => (prev === field ? null : prev)), 3000);
  }, []);

  if (isLoading) {
    return (
      <div className="app-surface flex h-48 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading thread workspace...
      </div>
    );
  }

  if (isError || !thread) {
    return (
      <div className="app-surface flex h-48 items-center justify-center text-sm text-muted-foreground">
        Thread not found.
      </div>
    );
  }

  const spans: SourceSpan[] = thread.state.extraction?.source_spans ?? [];
  const showBanner = health && !health.openrouter_connected;
  const overallHealth = getOverallHealth(thread);
  const fieldStatuses: Record<string, TrafficLight> = thread.state.extraction
    ? {
        sender_name: thread.state.extraction.sender_name.status,
        sender_type: thread.state.extraction.sender_type.status,
        urgency: thread.state.extraction.urgency.status,
        summary: thread.state.extraction.summary.status,
        property: thread.state.extraction.property.status,
        ...Object.fromEntries(
          thread.state.extraction.problems.map((problem) => [problem.id, problem.status])
        ),
      }
    : {};

  return (
    <div className="space-y-3">
      {showBanner && (
        <div className="app-surface flex items-center gap-3 px-4 py-2.5 text-sm text-amber-900">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <WifiOff className="size-4" />
          </div>
          <div>
            <p className="font-semibold">Live AI is disconnected.</p>
            <p className="text-xs text-amber-800/80">
              Thread analysis and draft generation are currently running in mock mode.
            </p>
          </div>
        </div>
      )}

      <div className="app-surface px-4 py-3.5 md:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h2 className="text-xl font-semibold tracking-[-0.03em] md:text-[1.5rem]">
              {thread.subject}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border/80 bg-background px-2.5 py-1">
                {thread.property_name}
              </span>
              <span className="rounded-full border border-border/80 bg-background px-2.5 py-1">
                {thread.emails.length} email{thread.emails.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-border/80 bg-background px-2.5 py-1">
                {thread.state.actions.length} action{thread.state.actions.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-border/80 bg-background px-2.5 py-1">
                {spans.length} source highlight{spans.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={overallHealth} />
            <span className="rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {formatStatusLabel(thread.state.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[236px_minmax(0,1fr)_360px] xl:items-start">
        <div className="order-3 min-h-[16rem] xl:order-1 xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)]">
          <HistoryPanel thread={thread} />
        </div>

        <div className="order-1 min-h-[26rem] xl:order-2">
          <EmailChain
            emails={thread.emails}
            subject={thread.subject}
            spans={spans}
            fieldStatuses={fieldStatuses}
            activeField={activeField}
            actions={thread.state.actions}
            onBack={() => navigate("/")}
            onSpanClick={handleSpanClick}
          />
        </div>

        <div className="order-2 min-h-[22rem] xl:order-3 xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)]">
          <ExtractionPanel
            thread={thread}
            activeField={activeField}
            onFieldClick={handleFieldClick}
          />
        </div>
      </div>
    </div>
  );
}
