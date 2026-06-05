import { Info } from "lucide-react";

export function InfoTooltip({ label, text }: { label: string; text: string }) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <span className="sr-only">{label}</span>
      <Info className="h-3.5 w-3.5 text-mutedText" aria-hidden="true" />
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-sidebar p-3 text-xs leading-5 text-secondaryText shadow-panel group-hover:block">
        {text}
      </span>
    </span>
  );
}
