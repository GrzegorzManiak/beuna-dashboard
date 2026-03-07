import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Pencil,
  Check,
  X,
  Loader2,
  Zap,
  Send,
  CheckCircle2,
  Info,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot, StatusBadge } from "@/components/StatusIndicator";
import { cn } from "@/lib/utils";
import type {
  ThreadDetail,
  ExtractedField,
  Problem,
  TrafficLight,
  ThreadAction,
  ActionType,
} from "@shared/types";
import {
  useAnalyzeThread,
  useUpdateThread,
  useTriggerAction,
  useApproveAction,
  useResolveThread,
} from "@/hooks/useThreads";

// ── Editable field row ───────────────────────────────────────────────
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
        "flex items-center gap-2 py-1.5 px-2 -mx-2 rounded cursor-pointer transition-colors duration-150",
        isActive ? "bg-violet-50" : "hover:bg-muted/40",
      )}
    >
      <StatusDot status={field.status} size="xs" />
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            {options ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value as T)}
                className="text-[12px] border border-border rounded px-1.5 py-0.5 flex-1 bg-white outline-none"
              >
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value as T)}
                className="text-[12px] border border-border rounded px-1.5 py-0.5 flex-1 bg-white outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancel();
                }}
              />
            )}
            <button onClick={(e) => { e.stopPropagation(); save(); }} className="p-0.5 hover:bg-emerald-50 rounded">
              <Check className="size-3 text-emerald-600" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); cancel(); }} className="p-0.5 hover:bg-red-50 rounded">
              <X className="size-3 text-red-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/edit">
            <span className="text-[12px] font-medium truncate">{field.value}</span>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {Math.round(field.confidence * 100)}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="p-0.5 rounded opacity-0 group-hover/edit:opacity-100 transition-opacity"
            >
              <Pencil className="size-2.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Problem card ─────────────────────────────────────────────────────
function ProblemCard({
  problem,
  threadId,
  isActive,
  onStatusChange,
  onFieldClick,
}: {
  problem: Problem;
  threadId: string;
  isActive?: boolean;
  onStatusChange: (id: string, status: TrafficLight) => void;
  onFieldClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const triggerAction = useTriggerAction();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setExpanded(true);
    }
  }, [isActive]);

  const statusBorder: Record<TrafficLight, string> = {
    red: "border-l-red-500",
    orange: "border-l-amber-400",
    green: "border-l-emerald-500",
  };

  return (
    <div
      ref={ref}
      data-field={problem.id}
      onClick={onFieldClick}
      className={cn(
        "border border-border/60 border-l-2 rounded-sm transition-colors duration-150 cursor-pointer",
        statusBorder[problem.status],
        isActive && "bg-violet-50/50",
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
      >
        <StatusDot status={problem.status} size="xs" />
        <span className="text-[12px] font-medium flex-1 truncate">{problem.title}</span>
        <span className="text-[10px] text-muted-foreground capitalize">{problem.category}</span>
        <ChevronDown className={cn("size-3 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      <div className={cn(
        "grid transition-all duration-200",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}>
        <div className="overflow-hidden">
          <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/40 pt-2">
            <p className="text-[11px] text-foreground/70 leading-relaxed">{problem.description}</p>

            {problem.requires_info && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50/60 rounded-sm px-2 py-1.5 border border-amber-100">
                <Info className="size-3 mt-0.5 shrink-0" />
                <span><strong>Missing:</strong> {problem.requires_info}</span>
              </div>
            )}

            {problem.suggested_action && (
              <p className="text-[11px] text-muted-foreground">
                → {problem.suggested_action}
              </p>
            )}

            {/* Status actions */}
            <div className="flex items-center gap-1 pt-0.5">
              {problem.status === "red" && (
                <>
                  <Button size="xs" variant="outline" className="text-[10px] h-5 px-1.5"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, "orange"); }}>
                    Mark yellow
                  </Button>
                  <Button size="xs" variant="outline" className="text-[10px] h-5 px-1.5"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, "green"); }}>
                    Mark green
                  </Button>
                </>
              )}
              {problem.status === "orange" && (
                <>
                  <Button size="xs" variant="outline" className="text-[10px] h-5 px-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerAction.mutate({ threadId, type: "request_info", problemId: problem.id });
                    }}
                    disabled={triggerAction.isPending}>
                    <Send className="size-2.5 mr-0.5" /> Request info
                  </Button>
                  <Button size="xs" variant="outline" className="text-[10px] h-5 px-1.5"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, "green"); }}>
                    Mark green
                  </Button>
                </>
              )}
              {problem.status === "green" && (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3" /> Resolved
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action card (pending review) ─────────────────────────────────────
function ActionCard({
  action,
  threadId,
}: {
  action: ThreadAction;
  threadId: string;
}) {
  const approveAction = useApproveAction();
  const [showDraft, setShowDraft] = useState(false);

  // Don't show approved actions here — they appear in the email chain
  if (action.approved) return null;

  return (
    <div className="border border-amber-200 bg-amber-50/30 rounded-sm p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium capitalize">
          {action.type.replace(/_/g, " ")}
        </span>
        <span className="text-[10px] text-amber-600 font-medium">Pending</span>
      </div>

      {action.draft_email && (
        <>
          <button
            onClick={() => setShowDraft(!showDraft)}
            className="text-[10px] text-primary font-medium hover:underline flex items-center gap-1"
          >
            {showDraft ? "Hide" : "Show"} draft
            <ChevronDown className={cn("size-2.5 transition-transform", showDraft && "rotate-180")} />
          </button>

          <div className={cn(
            "grid transition-all duration-200",
            showDraft ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}>
            <div className="overflow-hidden">
              <div className="text-[11px] text-foreground/70 whitespace-pre-wrap leading-relaxed border-l-2 border-border pl-2.5 py-1">
                {action.draft_email}
              </div>
            </div>
          </div>
        </>
      )}

      <Button
        size="xs"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] h-6"
        onClick={() => approveAction.mutate({ threadId, actionId: action.id })}
        disabled={approveAction.isPending}
      >
        {approveAction.isPending ? (
          <Loader2 className="size-3 animate-spin mr-1" />
        ) : (
          <ThumbsUp className="size-3 mr-1" />
        )}
        Approve & Send
      </Button>
    </div>
  );
}

// ── Main Extraction Panel ────────────────────────────────────────────
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
  const updateThread = useUpdateThread();
  const triggerAction = useTriggerAction();
  const resolveThread = useResolveThread();
  const extraction = thread.state.extraction;

  const hasRedItems = extraction?.problems.some((p) => p.status === "red") ?? false;
  const canResolve = extraction && !hasRedItems && thread.state.status !== "resolved";
  const allGreen = extraction && extraction.problems.every((p) => p.status === "green");

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
    const updatedProblems = extraction.problems.map((p) =>
      p.id === problemId ? { ...p, status } : p,
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
        red: extraction.problems.filter((p) => p.status === "red").length,
        orange: extraction.problems.filter((p) => p.status === "orange").length,
        green: extraction.problems.filter((p) => p.status === "green").length,
      }
    : null;

  const pendingActions = thread.state.actions.filter((a) => !a.approved);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header — tight */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Extraction
          </h3>
          {extraction && (
            <StatusBadge
              status={hasRedItems ? "red" : extraction.problems.some((p) => p.status === "orange") ? "orange" : "green"}
            />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{thread.property_name}</p>

        {/* Progress bar */}
        {problemStats && extraction!.problems.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden flex">
              {problemStats.green > 0 && (
                <div className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(problemStats.green / extraction!.problems.length) * 100}%` }} />
              )}
              {problemStats.orange > 0 && (
                <div className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${(problemStats.orange / extraction!.problems.length) * 100}%` }} />
              )}
              {problemStats.red > 0 && (
                <div className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${(problemStats.red / extraction!.problems.length) * 100}%` }} />
              )}
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {problemStats.green}/{extraction!.problems.length}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {!extraction ? (
          <div className="flex flex-col items-center justify-center h-64 px-6">
            <Zap className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-[12px] font-medium text-foreground mb-1">Ready to analyse</p>
            <p className="text-[10px] text-muted-foreground text-center mb-4 leading-relaxed">
              Extract sender info, urgency, problems and generate source highlights.
            </p>
            <Button
              size="sm"
              onClick={() => analyzeThread.mutate(thread.thread_id)}
              disabled={analyzeThread.isPending}
            >
              {analyzeThread.isPending ? (
                <Loader2 className="size-3 animate-spin mr-1" />
              ) : (
                <Zap className="size-3 mr-1" />
              )}
              {analyzeThread.isPending ? "Analysing…" : "Analyse Thread"}
            </Button>
            {analyzeThread.isError && (
              <p className="text-[10px] text-red-600 mt-2">{analyzeThread.error.message}</p>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 space-y-1.5">
            {/* Fields */}
            <FieldRow label="Name" field={extraction.sender_name} fieldKey="sender_name"
              isActive={activeField === "sender_name"} onClick={() => onFieldClick("sender_name")}
              onSave={(v, s) => handleFieldUpdate("sender_name", v, s)} />
            <FieldRow label="Type" field={extraction.sender_type} fieldKey="sender_type"
              isActive={activeField === "sender_type"} onClick={() => onFieldClick("sender_type")}
              options={["tenant", "landlord", "contractor", "prospect", "internal", "legal", "system", "external", "unknown"]}
              onSave={(v, s) => handleFieldUpdate("sender_type", v, s)} />

            <div className="border-t border-border/40 my-1" />

            <FieldRow label="Urgency" field={extraction.urgency} fieldKey="urgency"
              isActive={activeField === "urgency"} onClick={() => onFieldClick("urgency")}
              options={["critical", "high", "medium", "low"]}
              onSave={(v, s) => handleFieldUpdate("urgency", v, s)} />
            <FieldRow label="Property" field={extraction.property} fieldKey="property"
              isActive={activeField === "property"} onClick={() => onFieldClick("property")}
              onSave={(v, s) => handleFieldUpdate("property", v, s)} />
            <FieldRow label="Summary" field={extraction.summary} fieldKey="summary"
              isActive={activeField === "summary"} onClick={() => onFieldClick("summary")}
              onSave={(v, s) => handleFieldUpdate("summary", v, s)} />

            <div className="border-t border-border/40 my-1" />

            {/* Problems */}
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Problems
              </span>
              {problemStats && (
                <div className="flex items-center gap-0.5 ml-auto">
                  {problemStats.red > 0 && (
                    <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 rounded px-1 py-px font-medium tabular-nums">{problemStats.red}</span>
                  )}
                  {problemStats.orange > 0 && (
                    <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1 py-px font-medium tabular-nums">{problemStats.orange}</span>
                  )}
                  {problemStats.green > 0 && (
                    <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 rounded px-1 py-px font-medium tabular-nums">{problemStats.green}</span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {extraction.problems.map((problem) => (
                <ProblemCard
                  key={problem.id}
                  problem={problem}
                  threadId={thread.thread_id}
                  isActive={activeField === problem.id}
                  onStatusChange={handleProblemStatusChange}
                  onFieldClick={() => onFieldClick(problem.id)}
                />
              ))}
            </div>

            {/* Quick actions */}
            <div className="border-t border-border/40 my-1" />
            <div className="flex items-center gap-1.5 py-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {([
                { type: "acknowledge", label: "Acknowledge" },
                { type: "request_info", label: "Request Info" },
                { type: "maintenance_request", label: "Maintenance" },
                { type: "escalate", label: "Escalate" },
              ] as Array<{ type: ActionType; label: string }>).map(({ type, label }) => (
                <Button key={type} size="xs" variant="outline" className="text-[10px] h-5 px-1.5"
                  onClick={() => triggerAction.mutate({ threadId: thread.thread_id, type })}
                  disabled={triggerAction.isPending}>
                  {label}
                </Button>
              ))}
            </div>

            {/* Pending actions */}
            {pendingActions.length > 0 && (
              <div className="space-y-1.5">
                {pendingActions.map((action) => (
                  <ActionCard key={action.id} action={action} threadId={thread.thread_id} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {extraction && (
        <div className="px-3 py-2 border-t border-border">
          {thread.state.status === "resolved" ? (
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 text-[11px] font-medium py-0.5">
              <CheckCircle2 className="size-3.5" />
              Resolved
            </div>
          ) : canResolve ? (
            <Button
              size="sm"
              className={cn(
                "w-full text-[11px]",
                allGreen
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700",
              )}
              onClick={() => resolveThread.mutate(thread.thread_id)}
              disabled={resolveThread.isPending}
            >
              {resolveThread.isPending && <Loader2 className="size-3 animate-spin mr-1" />}
              {allGreen ? "Resolve" : "Resolve with warnings"}
            </Button>
          ) : (
            <div className="text-center">
              <p className="text-[10px] text-red-600 font-medium flex items-center justify-center gap-1 mb-1.5">
                <AlertTriangle className="size-3" />
                Red items require human action
              </p>
              <Button size="sm" className="w-full text-[11px]" variant="outline" disabled>
                Resolve
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
