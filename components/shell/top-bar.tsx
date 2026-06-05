import Link from "next/link";
import { Search, Star } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-page/90 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-64 flex-1 lg:max-w-md">
          <span className="sr-only">Ticker search</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mutedText" />
          <input className="w-full rounded-xl border border-border bg-sidebar py-2 pl-9 pr-3 text-sm text-primaryText outline-none placeholder:text-mutedText focus:border-accent" placeholder="Search ticker, fund, macro series..." />
        </label>
        <div className="flex items-center gap-2 text-xs text-mutedText">
          <StatusBadge status="delayed" label="mock" />
          <span>Market: Premarket / After-hours aware</span>
          <span className="hidden md:inline">Updated 1:35 PM ET</span>
          <Link href="/watchlist" className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-secondaryText hover:bg-panelHover"><Star className="h-3.5 w-3.5" /> Watchlist</Link>
        </div>
      </div>
    </header>
  );
}
