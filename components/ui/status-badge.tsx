import type { FreshnessStatus } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const statusClass: Record<FreshnessStatus, string> = {
  fresh: "border-positive/40 bg-positive/10 text-positive",
  delayed: "border-warning/40 bg-warning/10 text-warning",
  stale: "border-neutral/40 bg-neutral/10 text-neutral",
  degraded: "border-warning/40 bg-warning/10 text-warning",
  unavailable: "border-negative/40 bg-negative/10 text-negative",
};

export function StatusBadge({ status, label }: { status: FreshnessStatus; label?: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", statusClass[status])}>
      {label ?? status}
    </span>
  );
}
