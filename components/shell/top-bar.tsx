import Link from "next/link";
import { Search, Star } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export function TopBar() {
  return (
    <div className="sticky top-0 z-10 border-b border-borderStrong bg-page/90 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-borderStrong bg-sidebar px-3 py-2 text-sm text-textMuted">
          <Search className="h-4 w-4" />
          <span>Search tickers…</span>
          <kbd className="ml-auto rounded border border-borderStrong px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
        </div>
        <div className="flex items-center gap-2 text-xs text-textMuted"><StatusBadge status="delayed" /> Market: Premarket / Open / After-hours aware</div>
        <div className="text-xs text-textMuted">Last updated: Mock ET snapshot</div>
        <div className="flex items-center gap-2 text-xs text-textMuted"><StatusBadge status="degraded" /> Data health</div>
        <Link href="/watchlist" className="inline-flex items-center gap-2 rounded-xl border border-borderStrong bg-panel px-3 py-2 text-xs text-textSecondary hover:bg-panelHover"><Star className="h-4 w-4" /> Watchlist</Link>
      </div>
    </div>
  );
}
