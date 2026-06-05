import type { Metric } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export function MetricRow({ metric }: { metric: Metric }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/50 py-2 last:border-0">
      <div>
        <p className="text-xs font-medium text-secondaryText">{metric.label}</p>
        {metric.source ? <p className="text-[10px] text-mutedText">{metric.source}</p> : null}
      </div>
      <span className="font-mono text-sm text-primaryText">{metric.value}</span>
      <span className={cn("font-mono text-xs", metric.direction === "up" && "text-positive", metric.direction === "down" && "text-negative", metric.direction === "flat" && "text-neutral")}>
        {metric.changePercent || metric.change || "—"}
      </span>
    </div>
  );
}
