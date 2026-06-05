import type { FreshnessStatus } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

const statusStyles: Record<FreshnessStatus, string> = {
  fresh: "border-positive/30 bg-positive/10 text-positive",
  delayed: "border-accent/30 bg-accent/10 text-accent",
  stale: "border-warning/30 bg-warning/10 text-warning",
  degraded: "border-warning/40 bg-warning/10 text-warning",
  unavailable: "border-negative/35 bg-negative/10 text-negative"
};

export function StatusBadge({ status, label }: { status: FreshnessStatus; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em]", statusStyles[status])}>
      {label ?? status}
    </span>
  );
}
