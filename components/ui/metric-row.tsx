import type { Metric } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

const tone = { positive: "text-positive", negative: "text-negative", neutral: "text-textSecondary", warning: "text-warning" };

export function MetricRow({ metric }: { metric: Metric }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-borderStrong/60 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-xs text-textMuted">{metric.label}</p>
        {metric.source ? <p className="truncate text-[10px] text-textMuted/70">{metric.source}</p> : null}
      </div>
      <div className="text-right tabular">
        <p className="text-sm font-semibold text-textPrimary">{metric.value}</p>
        {(metric.change || metric.changePercent) ? <p className={cn("text-xs", tone[metric.tone])}>{[metric.change, metric.changePercent].filter(Boolean).join(" ")}</p> : null}
      </div>
    </div>
  );
}
