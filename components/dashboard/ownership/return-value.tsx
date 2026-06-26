"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

export const returnPct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const returnToneClass = (v: number | null | undefined) =>
  v == null ? "text-textMuted" : v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-textMuted";

export function ReturnValue({ value, spy, digits = 1 }: { value: number | null; spy: number | null; digits?: number }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const diff = value != null && spy != null ? value - spy : null;
  const showTooltip = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPosition({ left: rect.left, top: rect.bottom + 8 });
    setOpen(true);
  };
  return (
    <span
      ref={anchorRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onFocus={showTooltip}
      onMouseLeave={() => setOpen(false)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span className={returnToneClass(value)}>{returnPct(value, digits)}</span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[9999] min-w-44 border border-borderStrong bg-sidebar p-2 text-xs text-textSecondary opacity-100 shadow-2xl shadow-black/60"
              style={{ left: position.left, top: position.top }}
            >
              <span className="block">SPY: {returnPct(spy, digits)}</span>
              <span className={cn("block", returnToneClass(diff))}>
                {diff == null
                  ? "—"
                  : diff >= 0
                    ? `Outperformed by ${returnPct(diff, digits)}`
                    : `Underperformed by ${returnPct(diff, digits)}`}
              </span>
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
