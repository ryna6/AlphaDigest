"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { StatusValue } from "@/lib/status/jobs";

const statusDot: Record<StatusValue, string> = {
  Healthy: "bg-[#22c55e]",
  Warning: "bg-[#facc15]",
  Error: "bg-[#ff5a5f]",
  Unknown: "bg-[#9ca3af]"
};

const rows: Array<{ status: StatusValue; label: string; description: string }> = [
  { status: "Healthy", label: "Good", description: "Component is healthy and recently updated." },
  { status: "Warning", label: "Warning", description: "Component is delayed, missing, or needs attention soon." },
  { status: "Error", label: "Critical", description: "Component has a major issue or requires action." },
  { status: "Unknown", label: "Offline", description: "No recent status is available." }
];

export function StatusBreakdownButton() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open status breakdown"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-borderStrong bg-background/70 text-textMuted transition hover:border-accentBlue/50 hover:text-textPrimary focus:outline-none focus:ring-1 focus:ring-accentBlue"
        onClick={() => setOpen(true)}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto border border-borderStrong bg-panel p-5 shadow-panel"
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
                onClick={() => setOpen(false)}
              >
                X
              </button>
            </div>
            <div className="space-y-3 text-sm leading-6 text-textSecondary">
              {rows.map((row) => (
                <div key={row.status} className="flex items-start gap-3 rounded-none border border-borderStrong bg-sidebar/70 p-3">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[row.status]}`} aria-hidden="true" />
                  <p>
                    <span className="font-semibold text-textPrimary">{row.label}</span>
                    <span className="text-textMuted"> — {row.description}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
