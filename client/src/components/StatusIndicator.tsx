import type { TrafficLight } from "@shared/types";
import { cn } from "@/lib/utils";

const colors: Record<TrafficLight, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

const labels: Record<TrafficLight, string> = {
  green: "Auto-dispatch",
  orange: "Auto-email",
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
        "inline-block shrink-0 rounded-full",
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
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    orange: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        bg[status],
        className,
      )}
    >
      <StatusDot status={status} size="xs" />
      {labels[status]}
    </span>
  );
}
