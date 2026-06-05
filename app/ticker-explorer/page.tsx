import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

export default function TickerExplorerPage() {
  return <div className="space-y-4"><div><h1 className="text-2xl font-semibold">What is happening with this specific ticker?</h1><p className="text-sm text-mutedText">Rate-limit-aware search that will prioritize cached watchlist, recently searched, index, news, and flow tickers.</p></div><Panel><SectionHeader title="Ticker Search" subtitle="Client calls internal /api/ticker/[symbol], never third-party APIs directly."/><div className="flex max-w-xl gap-2"><input aria-label="Ticker symbol" placeholder="AAPL, NVDA, SPY…" className="flex-1 rounded-xl border border-border bg-sidebar px-3 py-2 text-sm outline-none focus:border-accent"/><Link href="/ticker/AAPL" className="rounded-xl border border-accent px-4 py-2 text-sm text-accent">Open AAPL example</Link></div></Panel><Panel><SectionHeader title="Rate-limit-aware messaging"/><EmptyState message="Full ticker pages are designed to cache watchlist tickers, recently searched tickers, major index constituents, and tickers appearing in news/flow/ownership feeds."/></Panel></div>;
}
