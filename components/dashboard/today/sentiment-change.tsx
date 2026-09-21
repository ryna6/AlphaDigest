"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

export type ChangeSentiment = {
  sentiment: "Bullish" | "Bearish" | null;
  className: string;
};

export function SentimentChange({
  value,
  appearance
}: {
  value: string;
  appearance: ChangeSentiment;
}) {
  const tooltipId = useId();

  if (!appearance.sentiment) {
    return (
      <span className={cn("shrink-0 text-right text-sm font-semibold", appearance.className)}>
        {value}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "group relative shrink-0 text-right text-sm font-semibold outline-none",
        appearance.className
      )}
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      {value}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 whitespace-nowrap border border-borderStrong bg-sidebar px-2 py-1 text-[11px] leading-none opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100"
      >
        {appearance.sentiment}
      </span>
    </span>
  );
}
