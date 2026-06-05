import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

export default function TickerExplorerPage() {
  return <><PageTitle title="Ticker Explorer" subtitle="Search a ticker without live fan-out. Full enrichment should use watchlist, recent-search, index constituent, and event-driven caches." /><Panel><SectionHeader title="Search state" /><div className="flex flex-col gap-3 md:flex-row"><input className="flex-1 rounded-xl border border-border bg-sidebar px-3 py-2 text-sm outline-none focus:border-accent" placeholder="AAPL, MSFT, NVDA..." /><Link href="/ticker/AAPL" className="rounded-xl bg-accent px-4 py-2 text-center text-sm font-medium text-white">Open AAPL example</Link></div><p className="mt-3 text-xs text-warning">Rate-limit-aware messaging: live source fan-out is disabled in the MVP. Mock/cached modules render partial data when live adapters are unavailable.</p></Panel><div className="mt-4 grid gap-4 md:grid-cols-3"><EmptyState message="Flow data unavailable or stale. Last successful update: 9:30 AM ET." /><EmptyState message="Ownership snapshot will hydrate from latest 13F cache." /><EmptyState message="News/event timeline will use cached recent ticker events." /></div></>;
}
