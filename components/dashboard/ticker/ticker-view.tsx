import Link from "next/link";
import { tickerMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { MiniChart } from "@/components/ui/mini-chart";

export function TickerExplorerView() {
  return <><PageTitle title="Ticker Explorer" subtitle="Search any ticker without over-fetching live sources." /><Panel><SectionHeader title="Search" subtitle="MVP search is non-functional; use the example ticker page." /><div className="rounded-xl border border-borderStrong bg-sidebar p-4 text-sm text-textMuted">Search input placeholder. Full pages will be cached for watchlist tickers, recent searches, major constituents, and tickers appearing in source feeds.</div><Link className="mt-3 inline-flex rounded-lg border border-accentBlue/40 bg-accentBlue/10 px-3 py-2 text-sm text-accentBlue" href="/ticker/AAPL">Open AAPL example</Link></Panel></>;
}

export function TickerDetailView({ symbol }: { symbol: string }) {
  const data = tickerMock(symbol);
  return <><PageTitle title={`${data.symbol} Explorer`} subtitle="What is happening with this specific ticker." /><div className="grid gap-4 xl:grid-cols-[1fr_360px]"><Panel><SectionHeader title="Ticker Header" />{data.header.map((m) => <MetricRow key={m.label} metric={m} />)}</Panel><Panel><SectionHeader title="Price / OHLC Chart" subtitle="Mock chart placeholder: 1D / 5D / 1M / 3M / 1Y" /><MiniChart /></Panel></div><Panel className="mt-4"><SectionHeader title="Today’s Story" /><p className="text-sm leading-6 text-textSecondary">{data.story}</p></Panel><div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionHeader title="Event Timeline" />{data.timeline.map((n) => <div key={n.headline} className="border-b border-borderStrong py-2 text-sm last:border-b-0"><p>{n.headline}</p><p className="text-xs text-textMuted">{n.timestamp} • {n.source}</p></div>)}</Panel><Panel><SectionHeader title="Flow Snapshot" />{data.flow.map((m) => <MetricRow key={m.label} metric={m} />)}</Panel><Panel><SectionHeader title="Ownership Snapshot" />{data.ownership.map((m) => <MetricRow key={m.label} metric={m} />)}</Panel><Panel><SectionHeader title="Macro / Sector Context" />{data.sectorContext.map((m) => <MetricRow key={m.label} metric={m} />)}</Panel></div></>;
}
