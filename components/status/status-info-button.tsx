"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

const statusDefinitions = [
  { label: "Good", text: "Component is healthy and recently updated." },
  { label: "Warning", text: "Component is delayed, missing, or needs attention soon." },
  { label: "Critical", text: "Component has a major issue or requires action." },
  { label: "Offline", text: "No recent status is available." }
] as const;

export function StatusInfoButton() {
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
        aria-label="Open component status definitions"
        className={cn(
          "flex h-7 w-7 items-center justify-center border border-borderStrong bg-sidebar text-xs font-semibold text-textSecondary",
          "hover:border-accentBlue/50 hover:text-textPrimary focus:outline-none focus:ring-1 focus:ring-accentBlue"
        )}
        onClick={() => setOpen(true)}
      >
        i
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
            className="max-h-[85vh] w-full max-w-2xl overflow-auto border border-borderStrong bg-panel p-5 shadow-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 id={titleId} className="text-lg font-semibold text-textPrimary">
                Component Status
              </h3>
              <button
                type="button"
                aria-label="Close component status definitions"
                className="border border-borderStrong px-2 py-1 text-sm text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
                onClick={() => setOpen(false)}
              >
                X
              </button>
            </div>
            <div className="divide-y divide-borderStrong text-sm leading-6 text-textSecondary">
              {statusDefinitions.map((definition) => (
                <div key={definition.label} className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
                  <span className="font-semibold text-textPrimary">{definition.label}</span>
                  <span>{definition.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
