import type { TrafficLight } from "@shared/types";
import { cn } from "@/lib/utils";

const colors: Record<TrafficLight, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

const glows: Record<TrafficLight, string> = {
  green: "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
  orange: "shadow-[0_0_6px_rgba(245,158,11,0.5)]",
  red: "shadow-[0_0_6px_rgba(239,68,68,0.6)]",
};

const labels: Record<TrafficLight, string> = {
  green: "Complete",
  orange: "Needs attention",
  red: "Blocked",
};

export function StatusDot({
  status,
  size = "sm",
  className,
}: {
  status: TrafficLight;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClass =
    size === "xs" ? "size-2" : size === "sm" ? "size-2.5" : "size-3.5";
  return (
    <span
      title={labels[status]}
      className={cn(
        "inline-block shrink-0 rounded-full transition-all duration-300",
        colors[status],
        glows[status],
        sizeClass,
        status === "red" && "animate-pulse",
        className
      )}
    />
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: TrafficLight;
  className?: string;
}) {
  const bg: Record<TrafficLight, string> = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    orange: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        bg[status],
        className
      )}
    >
      <StatusDot status={status} size="xs" />
      {labels[status]}
    </span>
  );
}
