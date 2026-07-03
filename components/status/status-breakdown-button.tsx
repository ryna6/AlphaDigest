"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { StatusValue } from "@/lib/status/jobs";

const statusRows: { status: StatusValue; label: string; description: string }[] = [
  { status: "Healthy", label: "Good", description: "Component is healthy and recently updated." },
  { status: "Warning", label: "Warning", description: "Component is delayed, missing, or needs attention soon." },
  { status: "Error", label: "Critical", description: "Component has a major issue or requires action." },
  { status: "Unknown", label: "Offline", description: "No recent status is available." }
];

const statusDot: Record<StatusValue, string> = {
  Healthy: "bg-[#22c55e]",
  Warning: "bg-[#facc15]",
  Error: "bg-[#ff5a5f]",
  Unknown: "bg-[#9ca3af]"
};

function StatusBreakdownModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto border border-borderStrong bg-panel p-5 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-textPrimary">
            Status Breakdown
          </h3>
          <button
            type="button"
            aria-label="Close status breakdown"
            className="border border-borderStrong px-2 py-1 text-sm text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <div className="space-y-3 text-sm leading-6 text-textSecondary">
          {statusRows.map((row) => (
            <div
              key={row.status}
              className="grid grid-cols-[0.625rem_minmax(4.75rem,auto)] items-start gap-x-3 gap-y-1 sm:grid-cols-[0.625rem_5.25rem_minmax(0,1fr)]"
            >
              <span className={cn("mt-2 h-2.5 w-2.5 rounded-full", statusDot[row.status])} aria-hidden="true" />
              <span className="font-semibold text-textPrimary">{row.label}</span>
              <span className="col-span-2 pl-[calc(0.625rem+0.75rem)] sm:col-span-1 sm:pl-0">
                {row.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatusBreakdownButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Open status breakdown"
        className={cn(
          "flex h-7 w-7 items-center justify-center border border-borderStrong bg-sidebar text-xs font-semibold text-textSecondary",
          "hover:border-accentBlue/50 hover:text-textPrimary focus:outline-none focus:ring-1 focus:ring-accentBlue"
        )}
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open ? <StatusBreakdownModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
