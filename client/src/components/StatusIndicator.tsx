import type { TrafficLight } from "@shared/types";
import { cn } from "@/lib/utils";

const colors: Record<TrafficLight, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-rose-500",
};

const labels: Record<TrafficLight, string> = {
  green: "Clear",
  orange: "Review",
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
    size === "xs" ? "size-1.5" : size === "sm" ? "size-2" : "size-3";
  return (
    <span
      title={labels[status]}
      className={cn(
        "inline-block shrink-0 rounded-full ring-2 ring-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]",
        colors[status],
        sizeClass,
        className,
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
    green: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    orange: "bg-amber-50 text-amber-700 border-amber-200/80",
    red: "bg-rose-50 text-rose-700 border-rose-200/80",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
        bg[status],
        className,
      )}
    >
      <StatusDot status={status} size="xs" />
      {labels[status]}
    </span>
  );
}
