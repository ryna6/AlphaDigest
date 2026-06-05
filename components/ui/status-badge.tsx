import type { FreshnessStatus } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

const colors: Record<FreshnessStatus | "ok" | "mock", string> = {
  fresh: "border-positive/30 bg-positive/10 text-positive",
  delayed: "border-warning/30 bg-warning/10 text-warning",
  stale: "border-warning/30 bg-warning/10 text-warning",
  degraded: "border-warning/30 bg-warning/10 text-warning",
  unavailable: "border-negative/30 bg-negative/10 text-negative",
  ok: "border-positive/30 bg-positive/10 text-positive",
  mock: "border-accentBlue/30 bg-accentBlue/10 text-accentBlue"
};

export function StatusBadge({ status, className }: { status: FreshnessStatus | "ok" | "mock"; className?: string }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", colors[status], className)}>{status}</span>;
}
