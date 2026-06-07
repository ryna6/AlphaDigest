import { Info } from "lucide-react";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 text-textMuted" aria-label={text} />
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-72 -translate-x-1/2 whitespace-pre-line rounded-none border border-borderStrong bg-sidebar p-3 text-xs leading-5 text-textSecondary shadow-panel group-hover:block">
        {text}
      </span>
    </span>
  );
}
