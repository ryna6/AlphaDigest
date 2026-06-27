"use client";

import { Info } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

export function InfoTooltip({
  text,
  placement = "bottom",
  size = "default"
}: {
  text: string;
  placement?: "top" | "right" | "bottom";
  size?: "default" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showTooltip = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      const top =
        placement === "top"
          ? rect.top - 8
          : placement === "right"
            ? rect.top + rect.height / 2
            : rect.bottom + 8;
      const left = placement === "right" ? rect.right + 8 : rect.left + rect.width / 2;
      setPosition({ left, top });
    }
    setOpen(true);
  };
  const hideTooltip = () => setOpen(false);
  const toggleTooltip = () => {
    if (open) {
      hideTooltip();
      return;
    }
    showTooltip();
  };

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={showTooltip}
      onFocus={showTooltip}
      onMouseLeave={hideTooltip}
      onBlur={hideTooltip}
      onClick={toggleTooltip}
      onKeyDown={(event) => {
        if (event.key === "Escape") hideTooltip();
      }}
      role="button"
      tabIndex={0}
    >
      <Info className="h-3.5 w-3.5 text-textMuted" aria-label={text} />
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              className={cn(
                "pointer-events-none fixed z-[9999] whitespace-pre-line rounded-none border border-borderStrong bg-sidebar text-left text-textSecondary opacity-100 shadow-2xl shadow-black/60",
                placement === "top" && "-translate-x-1/2 -translate-y-full",
                placement === "right" && "-translate-y-1/2",
                placement === "bottom" && "-translate-x-1/2",
                size === "compact"
                  ? "w-[15.3rem] p-2.5 text-[11px] leading-4"
                  : "w-72 p-3 text-[11px] leading-4"
              )}
              style={{ left: position.left, top: position.top }}
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
