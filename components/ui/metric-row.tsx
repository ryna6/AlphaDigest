import type { Metric } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

export function MetricRow({ metric }: { metric: Metric }) {
  const negative = metric.changePercent?.startsWith("-") || metric.change?.startsWith("-");
  return (
    <div className="flex items-center justify-between border-b border-border/70 py-2 last:border-0">
      <span className="text-xs text-secondaryText">{metric.label}</span>
      <div className="text-right tabular-nums">
        <div className="text-sm font-medium text-primaryText">{metric.value}</div>
        <div className={cn("text-xs", negative ? "text-negative" : "text-positive")}>{metric.change ?? ""} {metric.changePercent ?? ""}</div>
      </div>
    </div>
  );
}
