import { Search, Star } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-64 items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-sm text-mutedText">
          <Search className="h-4 w-4" />
          <span>Search ticker, fund, source…</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-mutedText">
          <StatusBadge status="delayed" label="Mock mode" />
          <span>Market: Premarket</span>
          <span>Last updated: 09:30 AM ET</span>
          <StatusBadge status="degraded" label="Degraded" />
          <Link href="/watchlist" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-secondaryText hover:bg-panelHover">
            <Star className="h-3 w-3" /> Watchlist
          </Link>
        </div>
      </div>
    </header>
  );
}
