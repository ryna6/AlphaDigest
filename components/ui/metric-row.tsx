import Image from "next/image";
import type { Metric } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

const tone = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-textSecondary",
  warning: "text-warning"
};

function signedValueClass(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^-|\s-/.test(trimmed)) return "text-negative";
  if (/^\+|\s\+/.test(trimmed)) return "text-positive";
  return undefined;
}

export function MetricRow({ metric }: { metric: Metric }) {
  const changeText = [metric.change, metric.changePercent].filter(Boolean).join(" ");
  const changeClass = signedValueClass(changeText) ?? tone[metric.tone];

  return (
    <div className="flex items-center justify-between gap-3 border-b border-borderStrong/60 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        {metric.iconPath ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
            <Image
              src={metric.iconPath}
              alt={`${metric.label} icon`}
              width={28}
              height={28}
              className="h-full w-full rounded-full object-cover"
            />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs text-textMuted">{metric.label}</p>
        </div>
      </div>
      <div className="text-right tabular">
        <p
          className={cn(
            "text-sm font-semibold",
            signedValueClass(metric.value) ?? "text-textPrimary"
          )}
        >
          {metric.value}
        </p>
        {changeText ? <p className={cn("text-xs", changeClass)}>{changeText}</p> : null}
      </div>
    </div>
  );
}
