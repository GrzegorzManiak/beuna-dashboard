import { useState, useEffect, useRef } from "react";
import {
  User,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Building2,
  Wrench,
  ChevronDown,
  Pencil,
  Check,
  X,
  Loader2,
  Zap,
  Send,
  CheckCircle2,
  MessageSquare,
  Info,
  ThumbsUp,
  Sparkles,
  Mail,
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
  icon: Icon,
  field,
  fieldKey,
  options,
  isActive,
  onSave,
  onClick,
}: {
  label: string;
  icon: typeof User;
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

  // Scroll into view when active
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
        "flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg cursor-pointer transition-all duration-300",
        isActive
          ? "bg-violet-50 ring-1 ring-violet-200"
          : "hover:bg-muted/50"
      )}
    >
      <Icon className={cn(
        "size-4 mt-0.5 shrink-0 transition-colors duration-200",
        isActive ? "text-violet-600" : "text-muted-foreground"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <StatusDot status={field.status} size="xs" />
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(field.confidence * 100)}%
          </span>
        </div>
        {editing ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            {options ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value as T)}
                className="text-sm border border-border rounded-md px-2 py-1 flex-1 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value as T)}
                className="text-sm border border-border rounded-md px-2 py-1 flex-1 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancel();
                }}
              />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); save(); }}
              className="p-1 rounded-md hover:bg-emerald-100 transition-colors"
            >
              <Check className="size-3.5 text-emerald-600" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); cancel(); }}
              className="p-1 rounded-md hover:bg-red-100 transition-colors"
            >
              <X className="size-3.5 text-red-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group/edit">
            <span className="text-sm font-medium">{field.value}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="p-0.5 rounded opacity-0 group-hover/edit:opacity-100 hover:bg-muted transition-all"
            >
              <Pencil className="size-3 text-muted-foreground" />
            </button>
          </div>
        )}
        {field.note && (
          <p className="text-[11px] text-muted-foreground mt-0.5 italic">{field.note}</p>
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

  // Auto-expand + scroll when activated from highlight click
  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setExpanded(true);
    }
  }, [isActive]);

  const categoryIcon: Record<string, string> = {
    maintenance: "🔧",
    noise: "🔊",
    legal: "⚖️",
    financial: "💰",
    safety: "🛡️",
    admin: "📋",
    lease: "📄",
    pest: "🐛",
    security: "🔒",
    compliance: "✅",
    other: "📌",
  };

  return (
    <div
      ref={ref}
      data-field={problem.id}
      onClick={onFieldClick}
      className={cn(
        "rounded-xl border p-3 transition-all duration-300 cursor-pointer",
        problem.status === "red" && "border-red-200 bg-red-50/40",
        problem.status === "orange" && "border-amber-200 bg-amber-50/40",
        problem.status === "green" && "border-emerald-200 bg-emerald-50/40",
        isActive && "ring-2 ring-violet-300 shadow-md scale-[1.01]"
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full flex items-start gap-2 text-left"
      >
        <span className="text-base leading-none mt-0.5">
          {categoryIcon[problem.category] ?? "📌"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{problem.title}</span>
            <StatusDot status={problem.status} size="xs" />
          </div>
          <span className="text-[11px] text-muted-foreground capitalize font-medium">
            {problem.category}
          </span>
        </div>
        <div className={cn(
          "p-0.5 rounded transition-transform duration-200",
          expanded && "rotate-180"
        )}>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200",
          expanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-2 border-t border-border/50 space-y-2.5">
            <p className="text-xs text-foreground/80 leading-relaxed">
              {problem.description}
            </p>

            {problem.requires_info && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                <Info className="size-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Missing info:</span>{" "}
                  {problem.requires_info}
                </div>
              </div>
            )}

            {problem.suggested_action && (
              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                <Wrench className="size-3.5 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Suggested:</span>{" "}
                  {problem.suggested_action}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-1">
              {problem.status === "red" && (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px]"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, "orange"); }}
                  >
                    <AlertTriangle className="size-3 mr-1 text-amber-500" />
                    Mark Orange
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px]"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, "green"); }}
                  >
                    <Check className="size-3 mr-1 text-emerald-500" />
                    Mark Green
                  </Button>
                </>
              )}
              {problem.status === "orange" && (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerAction.mutate({
                        threadId,
                        type: "request_info",
                        problemId: problem.id,
                      });
                    }}
                    disabled={triggerAction.isPending}
                  >
                    <Send className="size-3 mr-1" />
                    Request Info
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-[11px]"
                    onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, "green"); }}
                  >
                    <Check className="size-3 mr-1 text-emerald-500" />
                    Mark Green
                  </Button>
                </>
              )}
              {problem.status === "green" && (
                <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="size-3.5" /> Resolved
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action / Draft email card ────────────────────────────────────────
function ActionCard({
  action,
  threadId,
}: {
  action: ThreadAction;
  threadId: string;
}) {
  const approveAction = useApproveAction();
  const [showDraft, setShowDraft] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-all duration-300",
        action.approved
          ? "bg-emerald-50/30 border-emerald-200"
          : "bg-white border-border shadow-sm"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn(
          "size-6 rounded-full flex items-center justify-center",
          action.approved ? "bg-emerald-100" : "bg-amber-100"
        )}>
          {action.approved ? (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          ) : (
            <Mail className="size-3.5 text-amber-600" />
          )}
        </div>
        <span className="text-xs font-semibold capitalize flex-1">
          {action.type.replace(/_/g, " ")}
        </span>
        {action.approved ? (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-semibold">
            ✓ Sent
          </span>
        ) : (
          <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-semibold animate-pulse">
            Pending Review
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground ml-8 mb-2">
        {action.description} ·{" "}
        {new Date(action.timestamp).toLocaleTimeString("en-IE", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      {/* Draft email preview */}
      {action.draft_email && (
        <div className="ml-8">
          <button
            onClick={() => setShowDraft(!showDraft)}
            className="text-[11px] text-primary font-medium hover:underline flex items-center gap-1 mb-2"
          >
            <MessageSquare className="size-3" />
            {showDraft ? "Hide" : "Preview"} draft email
            <ChevronDown className={cn(
              "size-3 transition-transform duration-200",
              showDraft && "rotate-180"
            )} />
          </button>

          <div
            className={cn(
              "grid transition-all duration-300",
              showDraft ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="relative rounded-lg border border-border bg-white p-3 shadow-sm">
                {/* Compose-style header */}
                <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border/50">
                  <Send className="size-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Draft Response
                  </span>
                  <Sparkles className="size-3 text-violet-400 ml-auto" />
                  <span className="text-[10px] text-violet-500 font-medium">
                    AI Generated
                  </span>
                </div>
                <div className="text-xs text-foreground/85 whitespace-pre-wrap leading-relaxed font-[system-ui]">
                  {action.draft_email}
                </div>
              </div>
            </div>
          </div>

          {/* Approve button */}
          {!action.approved && (
            <div className="mt-2.5 flex gap-2">
              <Button
                size="xs"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() =>
                  approveAction.mutate({ threadId, actionId: action.id })
                }
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
          )}
        </div>
      )}
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

  // Check if all problems are at least orange (no red)
  const hasRedItems =
    extraction?.problems.some((p) => p.status === "red") ?? false;
  const canResolve =
    extraction && !hasRedItems && thread.state.status !== "resolved";
  const allGreen =
    extraction && extraction.problems.every((p) => p.status === "green");

  function handleFieldUpdate(
    field: string,
    value: string,
    status: TrafficLight
  ) {
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
      p.id === problemId ? { ...p, status } : p
    );
    updateThread.mutate({
      id: thread.thread_id,
      data: {
        extraction: {
          problems: updatedProblems,
        } as unknown as Record<string, unknown>,
      },
    });
  }

  // Compute summary stats
  const problemStats = extraction
    ? {
        red: extraction.problems.filter((p) => p.status === "red").length,
        orange: extraction.problems.filter((p) => p.status === "orange").length,
        green: extraction.problems.filter((p) => p.status === "green").length,
      }
    : null;

  return (
    <div className="h-full flex flex-col border-l border-border bg-gray-50/30">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            <h3 className="font-semibold text-sm">Analysis</h3>
          </div>
          {extraction && (
            <StatusBadge
              status={
                hasRedItems
                  ? "red"
                  : extraction.problems.some((p) => p.status === "orange")
                    ? "orange"
                    : "green"
              }
            />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 font-medium">
          {thread.property_name}
        </p>
        {/* Problem status bar */}
        {problemStats && extraction!.problems.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              {problemStats.green > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${(problemStats.green / extraction!.problems.length) * 100}%`,
                  }}
                />
              )}
              {problemStats.orange > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{
                    width: `${(problemStats.orange / extraction!.problems.length) * 100}%`,
                  }}
                />
              )}
              {problemStats.red > 0 && (
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{
                    width: `${(problemStats.red / extraction!.problems.length) * 100}%`,
                  }}
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {problemStats.green}/{extraction!.problems.length}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!extraction ? (
          /* Not yet analyzed */
          <div className="flex flex-col items-center justify-center h-72 px-8">
            <div className="relative mb-4">
              <div className="size-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Zap className="size-7 text-violet-500" />
              </div>
              <div className="absolute -top-1 -right-1 size-5 bg-amber-400 rounded-full flex items-center justify-center animate-bounce">
                <Sparkles className="size-3 text-white" />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground mb-1.5">
              Ready to Analyze
            </p>
            <p className="text-xs text-muted-foreground text-center mb-5 leading-relaxed">
              Run AI analysis to extract sender info, classify urgency, identify
              problems and generate source highlights.
            </p>
            <Button
              onClick={() => analyzeThread.mutate(thread.thread_id)}
              disabled={analyzeThread.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200"
            >
              {analyzeThread.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Zap className="size-4 mr-1.5" />
              )}
              {analyzeThread.isPending ? "Analyzing..." : "Analyze Thread"}
            </Button>
            {analyzeThread.isError && (
              <p className="text-xs text-red-600 mt-3 text-center">
                {analyzeThread.error.message}
              </p>
            )}
          </div>
        ) : (
          /* Extraction results */
          <div className="px-4 py-3 space-y-3">
            {/* ── Extracted Fields ──────────────────────── */}
            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Sender
              </h4>
              <FieldRow
                label="Name"
                icon={User}
                field={extraction.sender_name}
                fieldKey="sender_name"
                isActive={activeField === "sender_name"}
                onClick={() => onFieldClick("sender_name")}
                onSave={(v, s) => handleFieldUpdate("sender_name", v, s)}
              />
              <FieldRow
                label="Type"
                icon={ShieldAlert}
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
                onSave={(v, s) => handleFieldUpdate("sender_type", v, s)}
              />
            </section>

            <div className="border-t border-border/60" />

            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Classification
              </h4>
              <FieldRow
                label="Urgency"
                icon={AlertTriangle}
                field={extraction.urgency}
                fieldKey="urgency"
                isActive={activeField === "urgency"}
                onClick={() => onFieldClick("urgency")}
                options={["critical", "high", "medium", "low"]}
                onSave={(v, s) => handleFieldUpdate("urgency", v, s)}
              />
              <FieldRow
                label="Property"
                icon={Building2}
                field={extraction.property}
                fieldKey="property"
                isActive={activeField === "property"}
                onClick={() => onFieldClick("property")}
                onSave={(v, s) => handleFieldUpdate("property", v, s)}
              />
            </section>

            <div className="border-t border-border/60" />

            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Summary
              </h4>
              <FieldRow
                label="Summary"
                icon={FileText}
                field={extraction.summary}
                fieldKey="summary"
                isActive={activeField === "summary"}
                onClick={() => onFieldClick("summary")}
                onSave={(v, s) => handleFieldUpdate("summary", v, s)}
              />
            </section>

            <div className="border-t border-border/60" />

            {/* ── Problems ─────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Problems
                </h4>
                {problemStats && (
                  <div className="flex items-center gap-1">
                    {problemStats.red > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">
                        {problemStats.red}
                      </span>
                    )}
                    {problemStats.orange > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">
                        {problemStats.orange}
                      </span>
                    )}
                    {problemStats.green > 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 font-bold tabular-nums">
                        {problemStats.green}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
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
            </section>

            <div className="border-t border-border/60" />

            {/* ── Quick Actions ────────────────────────── */}
            <section>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Quick Actions
              </h4>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(
                  [
                    { type: "acknowledge", label: "Acknowledge", icon: Check },
                    { type: "request_info", label: "Request Info", icon: Info },
                    {
                      type: "maintenance_request",
                      label: "Maintenance",
                      icon: Wrench,
                    },
                    {
                      type: "escalate",
                      label: "Escalate",
                      icon: AlertTriangle,
                    },
                  ] as Array<{
                    type: ActionType;
                    label: string;
                    icon: typeof Check;
                  }>
                ).map(({ type, label, icon: ActionIcon }) => (
                  <Button
                    key={type}
                    size="xs"
                    variant="outline"
                    className="text-[11px] shadow-sm"
                    onClick={() =>
                      triggerAction.mutate({
                        threadId: thread.thread_id,
                        type,
                      })
                    }
                    disabled={triggerAction.isPending}
                  >
                    <ActionIcon className="size-3 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>

              {/* Action history */}
              {thread.state.actions.length > 0 && (
                <div className="space-y-2.5">
                  {thread.state.actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      threadId={thread.thread_id}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* ── Bottom bar: Continue / Resolve ─────────────── */}
      {extraction && (
        <div className="px-4 py-3 border-t border-border bg-white">
          {thread.state.status === "resolved" ? (
            <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-semibold py-1">
              <CheckCircle2 className="size-5" />
              Thread Resolved
            </div>
          ) : canResolve ? (
            <Button
              className={cn(
                "w-full shadow-md transition-all duration-300",
                allGreen
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                  : "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
              )}
              onClick={() => resolveThread.mutate(thread.thread_id)}
              disabled={resolveThread.isPending}
            >
              {resolveThread.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="size-4 mr-1.5" />
              )}
              {allGreen
                ? "Continue — Mark Resolved"
                : "Continue — Resolve (with warnings)"}
            </Button>
          ) : (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-red-600 mb-2 font-medium">
                <AlertTriangle className="size-3.5" />
                Resolve all red-status items to proceed
              </div>
              <Button className="w-full" variant="outline" disabled>
                <X className="size-4 mr-1.5" />
                Continue
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
