import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Pencil,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react";
import { StatusBadge, StatusDot } from "@/components/StatusIndicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ExtractedField,
  Problem,
  ThreadAction,
  ThreadDetail,
  TrafficLight,
} from "@shared/types";
import {
  useAnalyzeThread,
  useApproveAction,
  useTriggerAction,
  useUpdateThread,
} from "@/hooks/useThreads";

function getHealth(extraction: ThreadDetail["state"]["extraction"]): TrafficLight {
  if (!extraction) return "red";

  const states = [
    extraction.sender_name.status,
    extraction.sender_type.status,
    extraction.urgency.status,
    extraction.summary.status,
    extraction.property.status,
    ...extraction.problems.map((problem) => problem.status),
  ];

  if (states.includes("red")) return "red";
  if (states.includes("orange")) return "orange";
  return "green";
}

function SectionTitle({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <div className="ml-auto">{right}</div>
    </div>
  );
}

function FieldRow<T extends string>({
  label,
  field,
  fieldKey,
  options,
  isActive,
  onSave,
  onClick,
}: {
  label: string;
  field: ExtractedField<T>;
  fieldKey: string;
  options?: string[];
  isActive?: boolean;
  onSave: (value: string, status: TrafficLight) => void;
  onClick?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive]);

  function save() {
    onSave(editValue, "green");
    setEditing(false);
  }

  function cancel() {
    setEditValue(field.value);
    setEditing(false);
  }

  return (
    <div
      ref={ref}
      data-field={fieldKey}
      onClick={onClick}
      className={cn(
        "rounded-[16px] border px-3 py-3 transition-all",
        isActive
          ? "border-primary/30 bg-primary/5 shadow-[0_12px_22px_rgba(62,89,176,0.08)]"
          : "border-border/70 bg-white/70 hover:bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot status={field.status} size="xs" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {Math.round(field.confidence * 100)}%
        </span>
      </div>

      <div className="mt-3">
        {editing ? (
          <div className="flex items-center gap-2">
            {options ? (
              <select
                value={editValue}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setEditValue(event.target.value as T)}
                className="h-9 flex-1 rounded-[12px] border border-border/80 bg-white px-3 text-sm outline-none ring-offset-background focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10"
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={editValue}
                autoFocus
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setEditValue(event.target.value as T)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                  if (event.key === "Escape") cancel();
                }}
                className="h-9 flex-1 rounded-[12px] border border-border/80 bg-white px-3 text-sm outline-none ring-offset-background focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10"
              />
            )}

            <Button
              size="icon-xs"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                save();
              }}
            >
              <Check className="size-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                cancel();
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-semibold leading-relaxed text-foreground">
              {field.value}
            </p>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
              }}
            >
              <Pencil className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBadge({
  action,
  threadId,
}: {
  action: ThreadAction;
  threadId: string;
}) {
  const approveAction = useApproveAction();
  const [showDraft, setShowDraft] = useState(false);

  const typeLabels: Record<string, string> = {
    request_info: "Request info",
    forward_to_human: "Escalate to support",
    contractor_dispatch: "Dispatch contractor",
    acknowledge: "Acknowledge",
    maintenance_request: "Maintenance request",
    escalate: "Escalate",
    reply: "Reply",
  };

  const toneClasses: Record<string, string> = {
    request_info: "border-amber-200 bg-amber-50/80 text-amber-800",
    forward_to_human: "border-violet-200 bg-violet-50/80 text-violet-800",
    contractor_dispatch: "border-sky-200 bg-sky-50/80 text-sky-800",
    acknowledge: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
    maintenance_request: "border-sky-200 bg-sky-50/80 text-sky-800",
    escalate: "border-rose-200 bg-rose-50/80 text-rose-800",
    reply: "border-slate-200 bg-slate-50/80 text-slate-800",
  };

  if (action.approved) {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="size-3.5" />
        {(typeLabels[action.type] ?? action.type).replace(/\b\w/g, (char) => char.toUpperCase())} sent
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 rounded-[16px] border px-3 py-3 shadow-[0_8px_16px_rgba(15,23,42,0.04)]",
        toneClasses[action.type] ?? "border-slate-200 bg-slate-50/80 text-slate-800"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {action.auto_triggered && <Bot className="size-3.5 opacity-70" />}
          <p className="text-[12px] font-semibold tracking-[-0.01em]">
            {typeLabels[action.type] ?? action.type}
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
          Pending
        </span>
      </div>

      {action.draft_email && (
        <>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowDraft((value) => !value);
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold opacity-80 transition hover:opacity-100"
          >
            {showDraft ? "Hide" : "Preview"} draft
            <ChevronDown className={cn("size-3 transition-transform", showDraft && "rotate-180")} />
          </button>

          <div
            className={cn(
              "grid transition-all duration-200",
              showDraft ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="mt-3 rounded-[14px] border border-current/10 bg-white/50 px-3 py-3 text-[12px] leading-6">
                {action.draft_email}
              </div>
            </div>
          </div>
        </>
      )}

      <Button
        size="sm"
        className="mt-3 w-full"
        onClick={(event) => {
          event.stopPropagation();
          approveAction.mutate({ threadId, actionId: action.id });
        }}
        disabled={approveAction.isPending}
      >
        {approveAction.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ThumbsUp className="size-4" />
        )}
        Approve & Send
      </Button>
    </div>
  );
}

function ProblemCard({
  problem,
  threadId,
  isActive,
  action,
  onStatusChange,
  onFieldClick,
}: {
  problem: Problem;
  threadId: string;
  isActive?: boolean;
  action?: ThreadAction;
  onStatusChange: (id: string, status: TrafficLight) => void;
  onFieldClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setExpanded(true);
    }
  }, [isActive]);

  useEffect(() => {
    if (action && !action.approved) setExpanded(true);
  }, [action]);

  const tone = {
    red: "border-rose-200/80 bg-rose-50/60",
    orange: "border-amber-200/80 bg-amber-50/60",
    green: "border-emerald-200/80 bg-emerald-50/55",
  }[problem.status];

  return (
    <div
      ref={ref}
      data-field={problem.id}
      onClick={onFieldClick}
      className={cn(
        "rounded-[18px] border px-3 py-3 transition-all",
        tone,
        isActive && "shadow-[0_14px_24px_rgba(62,89,176,0.08)] ring-1 ring-primary/10"
      )}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((value) => !value);
        }}
        className="flex w-full items-start gap-2 text-left"
      >
        <div className="pt-1">
          <StatusDot status={problem.status} size="xs" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-[-0.01em]">{problem.title}</p>
            <span className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {problem.category}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {problem.status === "red"
              ? "Blocked"
              : problem.status === "orange"
                ? "Needs review"
                : "Clear to continue"}
          </p>
        </div>
        <ChevronDown className={cn("mt-0.5 size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-3 border-t border-current/10 pt-3">
            <p className="text-[13px] leading-6 text-foreground/80">{problem.description}</p>

            {problem.requires_info && (
              <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-amber-200 bg-amber-50/80 px-3 py-3 text-[12px] leading-6 text-amber-900">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <strong>Missing info:</strong> {problem.requires_info}
                </span>
              </div>
            )}

            {problem.suggested_action && (
              <p className="mt-3 text-[12px] font-medium text-muted-foreground">
                Suggested: {problem.suggested_action}
              </p>
            )}

            {problem.status === "red" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange(problem.id, "orange");
                  }}
                >
                  <ArrowRight className="size-3.5" />
                  Mark orange
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStatusChange(problem.id, "green");
                  }}
                >
                  <Check className="size-3.5" />
                  Mark green
                </Button>
              </div>
            )}

            {action && <ActionBadge action={action} threadId={threadId} />}

            {problem.status === "green" && !action && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Complete
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExtractionPanel({
  thread,
  activeField,
  onFieldClick,
}: {
  thread: ThreadDetail;
  activeField: string | null;
  onFieldClick: (field: string) => void;
}) {
  const analyzeThread = useAnalyzeThread();
  const triggerAction = useTriggerAction();
  const updateThread = useUpdateThread();
  const extraction = thread.state.extraction;
  const hasRedItems = extraction?.problems.some((problem) => problem.status === "red") ?? false;

  function handleFieldUpdate(field: string, value: string, status: TrafficLight) {
    if (!extraction) return;
    updateThread.mutate({
      id: thread.thread_id,
      data: {
        extraction: {
          [field]: { value, status, confidence: 1.0 },
        } as Record<string, unknown>,
      },
    });
  }

  function handleProblemStatusChange(problemId: string, status: TrafficLight) {
    if (!extraction) return;
    const updatedProblems = extraction.problems.map((problem) =>
      problem.id === problemId ? { ...problem, status } : problem
    );

    updateThread.mutate({
      id: thread.thread_id,
      data: {
        extraction: { problems: updatedProblems } as unknown as Record<string, unknown>,
      },
    });
  }

  const problemStats = extraction
    ? {
        red: extraction.problems.filter((problem) => problem.status === "red").length,
        orange: extraction.problems.filter((problem) => problem.status === "orange").length,
        green: extraction.problems.filter((problem) => problem.status === "green").length,
      }
    : null;

  const actionsByProblem = new Map<string, ThreadAction>();
  for (const action of thread.state.actions) {
    if (action.problem_id) actionsByProblem.set(action.problem_id, action);
  }

  const unlinkedPendingActions = thread.state.actions.filter(
    (action) => !action.approved && !action.problem_id
  );
  const supportEscalation = thread.state.actions.find(
    (action) => action.type === "forward_to_human" && !action.problem_id
  );
  const totalActions = thread.state.actions.length;
  const approvedActions = thread.state.actions.filter((action) => action.approved).length;
  const pendingActions = totalActions - approvedActions;

  return (
    <div className="app-surface flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="app-kicker">Extraction</span>
            <p className="mt-3 text-sm font-semibold tracking-[-0.01em]">{thread.property_name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Structured fields, review state, and triggered actions.
            </p>
          </div>

          <StatusBadge status={getHealth(extraction)} />
        </div>

        {problemStats && extraction && extraction.problems.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
              {problemStats.green > 0 && (
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(problemStats.green / extraction.problems.length) * 100}%` }}
                />
              )}
              {problemStats.orange > 0 && (
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${(problemStats.orange / extraction.problems.length) * 100}%` }}
                />
              )}
              {problemStats.red > 0 && (
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${(problemStats.red / extraction.problems.length) * 100}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <CountChip color="emerald" value={problemStats.green} />
              <CountChip color="amber" value={problemStats.orange} />
              <CountChip color="rose" value={problemStats.red} />
            </div>
          </div>
        )}
      </div>

      <div className="app-scroll flex-1 overflow-y-auto px-4 py-4">
        {!extraction ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[20px] border border-dashed border-border/80 bg-background/50 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700">
              <Zap className="size-5" />
            </div>
            <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">Ready to analyze</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Extract sender, urgency, summary, and problem actions in one pass.
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => analyzeThread.mutate(thread.thread_id)}
              disabled={analyzeThread.isPending}
            >
              {analyzeThread.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Zap className="size-4" />
              )}
              {analyzeThread.isPending ? "Analyzing..." : "Analyze thread"}
            </Button>
            {analyzeThread.isError && (
              <p className="mt-3 text-xs text-rose-600">{analyzeThread.error.message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="space-y-2">
              <SectionTitle title="Identity" />
              <FieldRow
                label="Name"
                field={extraction.sender_name}
                fieldKey="sender_name"
                isActive={activeField === "sender_name"}
                onClick={() => onFieldClick("sender_name")}
                onSave={(value, status) => handleFieldUpdate("sender_name", value, status)}
              />
              <FieldRow
                label="Type"
                field={extraction.sender_type}
                fieldKey="sender_type"
                isActive={activeField === "sender_type"}
                onClick={() => onFieldClick("sender_type")}
                options={[
                  "tenant",
                  "landlord",
                  "contractor",
                  "prospect",
                  "internal",
                  "legal",
                  "system",
                  "external",
                  "unknown",
                ]}
                onSave={(value, status) => handleFieldUpdate("sender_type", value, status)}
              />
            </section>

            <section className="space-y-2">
              <SectionTitle title="Classification" />
              <FieldRow
                label="Urgency"
                field={extraction.urgency}
                fieldKey="urgency"
                isActive={activeField === "urgency"}
                onClick={() => onFieldClick("urgency")}
                options={["critical", "high", "medium", "low"]}
                onSave={(value, status) => handleFieldUpdate("urgency", value, status)}
              />
              <FieldRow
                label="Property"
                field={extraction.property}
                fieldKey="property"
                isActive={activeField === "property"}
                onClick={() => onFieldClick("property")}
                onSave={(value, status) => handleFieldUpdate("property", value, status)}
              />
              <FieldRow
                label="Summary"
                field={extraction.summary}
                fieldKey="summary"
                isActive={activeField === "summary"}
                onClick={() => onFieldClick("summary")}
                onSave={(value, status) => handleFieldUpdate("summary", value, status)}
              />
            </section>

            <section className="space-y-2">
              <SectionTitle
                title="Problems"
                right={
                  problemStats && (
                    <div className="flex items-center gap-1">
                      <CountChip color="rose" value={problemStats.red} />
                      <CountChip color="amber" value={problemStats.orange} />
                      <CountChip color="emerald" value={problemStats.green} />
                    </div>
                  )
                }
              />
              <div className="space-y-2">
                {extraction.problems.map((problem) => (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    threadId={thread.thread_id}
                    isActive={activeField === problem.id}
                    action={actionsByProblem.get(problem.id)}
                    onStatusChange={handleProblemStatusChange}
                    onFieldClick={() => onFieldClick(problem.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <SectionTitle
                title="Human Support"
                right={
                  supportEscalation ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        supportEscalation.approved
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-violet-200 bg-violet-50 text-violet-700"
                      )}
                    >
                      {supportEscalation.approved ? "Sent" : "Queued"}
                    </span>
                  ) : undefined
                }
              />
              <div className="rounded-[18px] border border-border/70 bg-background/55 px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-violet-50 text-violet-700">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-[-0.01em]">
                      Optional internal escalation
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Send a separate internal handoff to human support without blocking the AI
                      reply to the customer.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={supportEscalation ? "secondary" : "outline"}
                        onClick={() =>
                          triggerAction.mutate({
                            threadId: thread.thread_id,
                            type: "forward_to_human",
                            description: "Manual support escalation alongside AI reply",
                          })
                        }
                        disabled={!!supportEscalation || triggerAction.isPending}
                      >
                        {triggerAction.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                        {supportEscalation
                          ? supportEscalation.approved
                            ? "Support escalation sent"
                            : "Support escalation queued"
                          : "Escalate to human support"}
                      </Button>
                      {hasRedItems && (
                        <span className="text-[11px] text-muted-foreground">
                          Recommended when a problem still needs human judgment.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {unlinkedPendingActions.length > 0 && (
              <section className="space-y-2">
                <SectionTitle title="Other Actions" />
                <div className="space-y-2">
                  {unlinkedPendingActions.map((action) => (
                    <ActionBadge key={action.id} action={action} threadId={thread.thread_id} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {extraction && (
        <div className="border-t border-border/70 px-4 py-4">
          {thread.state.status === "resolved" ? (
            <BottomState
              icon={CheckCircle2}
              tone="emerald"
              title="Resolved"
              text="All actions are approved and the thread is ready to close."
            />
          ) : thread.state.status === "in_progress" ? (
            <BottomState
              icon={Loader2}
              tone="violet"
              title="In progress"
              text="Approved responses are being processed."
              spinning
            />
          ) : totalActions > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {approvedActions}/{totalActions} actions approved
                </span>
                {pendingActions > 0 && <span>{pendingActions} awaiting approval</span>}
                {hasRedItems && (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <AlertTriangle className="size-3.5" />
                    {problemStats?.red} need judgment
                  </span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${totalActions > 0 ? (approvedActions / totalActions) * 100 : 0}%` }}
                />
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                {hasRedItems
                  ? pendingActions > 0
                    ? "AI replies can continue while support escalations stay optional."
                    : "Some items still need human judgment, but the rest of the workflow can continue."
                  : pendingActions > 0
                    ? "Approve remaining actions to move this thread forward."
                    : "No pending approvals."}
              </p>
            </div>
          ) : (
            <p className="text-center text-[11px] text-muted-foreground">
              No actions triggered yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CountChip({
  color,
  value,
}: {
  color: "emerald" | "amber" | "rose";
  value: number;
}) {
  if (value === 0) return null;

  const classes =
    color === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : color === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", classes)}>
      {value}
    </span>
  );
}

function BottomState({
  icon: Icon,
  tone,
  title,
  text,
  spinning = false,
}: {
  icon: typeof CheckCircle2;
  tone: "emerald" | "violet";
  title: string;
  text: string;
  spinning?: boolean;
}) {
  const classes =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-violet-200 bg-violet-50 text-violet-700";

  return (
    <div className={cn("rounded-[16px] border px-3.5 py-3", classes)}>
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-[12px] bg-white/60">
          <Icon className={cn("size-4", spinning && "animate-spin")} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em]">{title}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{text}</p>
        </div>
      </div>
    </div>
  );
}
