import { Info } from "lucide-react";

export function InfoTooltip({ label }: { label: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info className="h-3.5 w-3.5 text-mutedText" aria-label="Information" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-sidebar p-3 text-xs text-secondaryText shadow-panel group-hover:block">
        {label}
      </span>
    </span>
  );
}
