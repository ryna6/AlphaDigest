import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function InfoTooltip({
  text,
  placement = "bottom",
  size = "default"
}: {
  text: string;
  placement?: "top" | "bottom";
  size?: "default" | "compact";
}) {
  return (
    <span className="group relative inline-flex">
      <Info className="h-3.5 w-3.5 text-textMuted" aria-label={text} />
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 z-20 hidden -translate-x-1/2 whitespace-pre-line rounded-none border border-borderStrong bg-sidebar text-left text-textSecondary shadow-panel group-hover:block",
          placement === "top" ? "bottom-5" : "top-5",
          size === "compact"
            ? "w-[15.3rem] p-2.5 text-[11px] leading-4"
            : "w-72 p-3 text-xs leading-5"
        )}
      >
        {text}
      </span>
    </span>
  );
}
