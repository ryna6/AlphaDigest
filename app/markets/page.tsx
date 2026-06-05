import { ErrorState } from "@/components/ui/error-state";
import { Heatmap } from "@/components/ui/heatmap";
import { MetricRow } from "@/components/ui/metric-row";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";
import { heatmapTiles, marketStrip } from "@/lib/data/fixtures/market";

export default function MarketsPage() {
  const keyStatuses = getFinnhubKeyStatus();
  return (
    <>
      <PageTitle title="Markets" subtitle="What is moving across indices, sectors, crypto, commodities, rates, and macro indicators." />
      <Panel><div className="grid grid-cols-2 gap-x-6 md:grid-cols-4 xl:grid-cols-8">{marketStrip.map((metric) => <MetricRow key={metric.label} metric={metric} />)}</div></Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel>
          <SectionHeader title="Heatmap" eyebrow="Global Markets · Sectors · Crypto · Macro" action={<div className="flex gap-1 text-[11px]"><span className="rounded-lg bg-accent/15 px-2 py-1 text-accent">Sectors</span><span className="rounded-lg border border-border px-2 py-1 text-mutedText">Global</span><span className="rounded-lg border border-border px-2 py-1 text-mutedText">Crypto</span><span className="rounded-lg border border-border px-2 py-1 text-mutedText">Macro</span></div>} />
          <ErrorState message="Finnhub key missing for this heatmap? Add the required heatmap-specific Finnhub key in Netlify environment variables. Mock heatmap shown." />
          <div className="mt-3"><Heatmap tiles={heatmapTiles} /></div>
        </Panel>
        <div className="grid gap-4">
          <Panel><SectionHeader title="Finnhub Heatmap Key Status" /> <div className="space-y-2">{keyStatuses.map((item) => <div key={item.envName} className="rounded-xl border border-border bg-sidebar p-3"><div className="flex items-center justify-between"><span className="text-xs font-medium">{item.label}</span><StatusBadge status={item.status as "fresh" | "unavailable"} /></div><p className="mt-1 text-[11px] text-mutedText">{item.message}</p></div>)}</div></Panel>
          <Panel><SectionHeader title="Market Breadth" /><div className="space-y-2 text-sm text-secondaryText"><p>Participation: <span className="text-warning">Neutral</span></p><p>Advancers / Decliners: 312 / 191</p><p>Above 50D MA: 58%</p><p>New highs / lows: 76 / 21</p></div></Panel>
          <Panel><SectionHeader title="Leaders / Laggards" /><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="mb-2 text-mutedText">Leaders</p><p className="text-positive">NVDA +2.1%</p><p className="text-positive">XLK +1.2%</p></div><div><p className="mb-2 text-mutedText">Laggards</p><p className="text-negative">XLE -0.6%</p><p className="text-negative">IWM -0.1%</p></div></div></Panel>
        </div>
      </div>
    </>
  );
}
