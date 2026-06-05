import { InfoTooltip } from "@/components/ui/info-tooltip";
import { MetricRow } from "@/components/ui/metric-row";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { SourceFooter } from "@/components/ui/source-footer";
import { DataTable } from "@/components/ui/data-table";
import { Heatmap } from "@/components/ui/heatmap";
import { keyMarketStats, heatmapTiles, mockNews, mockSourceMeta } from "@/lib/data/fixtures/market";

const earnings = [
  { ticker: "ADBE", company: "Adobe", time: "AMC", eps: "$4.97", revenue: "$5.8B" },
  { ticker: "KR", company: "Kroger", time: "BMO", eps: "$1.42", revenue: "$45.1B" },
  { ticker: "LEN", company: "Lennar", time: "AMC", eps: "$2.19", revenue: "$8.2B" }
];
const calendar = [
  { time: "8:30 AM", event: "Payroll revisions", actual: "—", forecast: "—", previous: "—", importance: "High" },
  { time: "10:00 AM", event: "Wholesale inventories", actual: "—", forecast: "0.1%", previous: "0.0%", importance: "Med" }
];

export default function TodayPage() {
  return (
    <>
      <PageTitle title="Today" subtitle="What matters today: risk tone, key assets, catalysts, earnings, calendar, and sector leadership." />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <SectionHeader title="Daily Market Briefing" eyebrow="What matters today" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-sidebar p-3"><p className="text-xs text-mutedText">Risk tone</p><p className="mt-1 text-lg font-semibold text-positive">Constructive</p><p className="mt-1 text-xs text-secondaryText">VIX is softer while growth sectors lead.</p></div>
            <div className="rounded-xl border border-border bg-sidebar p-3"><p className="flex items-center gap-1 text-xs text-mutedText">VIX3M/VIX <InfoTooltip label="VIX3M/VIX" text="A healthy upward-sloping volatility curve often suggests calmer conditions. A compressed ratio can suggest near-term stress." /></p><p className="mt-1 text-lg font-semibold">1.14</p><p className="mt-1 text-xs text-secondaryText">Calmer backdrop, monitor compression.</p></div>
            <div className="rounded-xl border border-border bg-sidebar p-3"><p className="text-xs text-mutedText">Major catalyst</p><p className="mt-1 text-lg font-semibold">Rates + oil</p><p className="mt-1 text-xs text-secondaryText">Yields and crude are the macro watch items.</p></div>
          </div>
          <SourceFooter meta={mockSourceMeta} />
        </Panel>
        <Panel>
          <SectionHeader title="Key Market Stats" eyebrow="Compact cross-asset tape" />
          {keyMarketStats.map((metric) => <MetricRow key={metric.label} metric={metric} />)}
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Today's Top News" eyebrow="Unusual Whales featured news only" />
          <div className="space-y-3">{mockNews.map((item) => <article key={item.headline} className="rounded-xl border border-border bg-sidebar p-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{item.headline}</h3><span className="text-[11px] text-mutedText">{item.time}</span></div><p className="mt-1 text-xs text-secondaryText">{item.why}</p><div className="mt-2 flex gap-1">{item.tags.map((tag) => <span key={tag} className="rounded bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">{tag}</span>)}</div></article>)}</div>
        </Panel>
        <div className="grid gap-4">
          <Panel><SectionHeader title="Today's Earnings" /><DataTable columns={[{ key: "ticker", header: "Ticker" }, { key: "company", header: "Company" }, { key: "time", header: "Time" }, { key: "eps", header: "EPS", align: "right" }, { key: "revenue", header: "Revenue", align: "right" }]} rows={earnings} /></Panel>
          <Panel><SectionHeader title="Economic Calendar" /><DataTable columns={[{ key: "time", header: "Time" }, { key: "event", header: "Event" }, { key: "actual", header: "Actual", align: "right" }, { key: "forecast", header: "Forecast", align: "right" }, { key: "previous", header: "Previous", align: "right" }, { key: "importance", header: "Imp." }]} rows={calendar} /></Panel>
        </div>
      </div>
      <Panel className="mt-4"><SectionHeader title="Sector Performance Snapshot" eyebrow="Sector ETF universe" /><Heatmap tiles={heatmapTiles.slice(0, 4)} /></Panel>
    </>
  );
}
