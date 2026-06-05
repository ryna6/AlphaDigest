import { DataTable } from "@/components/ui/data-table";
import { Heatmap } from "@/components/ui/heatmap";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { MetricRow } from "@/components/ui/metric-row";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { SourceFooter } from "@/components/ui/source-footer";
import { compactColumns, earningsRows, economicRows, keyMarketStats, mockMeta, sectorHeatmap, topNews } from "@/lib/data/fixtures/dashboard";

export default function TodayPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primaryText">What matters today?</h1>
        <p className="text-sm text-mutedText">Compact daily briefing. Mock mode is clearly labeled until live adapters are configured.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_.9fr]">
        <Panel>
          <SectionHeader title="Market Summary" subtitle="Risk-on/risk-off combines breadth, VIX, yields, oil, gold, Bitcoin, earnings, and catalysts." />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Risk backdrop", "Constructive", "VIX3M/VIX remains upward-sloping"],
              ["Money moving", "Tech + Energy", "Leadership is narrow but improving"],
              ["Catalysts", "Fed + labor", "Economic calendar remains in focus"],
            ].map(([k, v, s]) => (
              <div key={k} className="rounded-xl border border-border bg-sidebar/40 p-3">
                <p className="text-xs text-mutedText">{k}</p><p className="mt-1 text-lg font-semibold text-primaryText">{v}</p><p className="mt-1 text-xs text-secondaryText">{s}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-secondaryText">Volatility curve <InfoTooltip label="VIX3M is 3-month implied volatility while VIX is roughly 30-day implied volatility. A compressed VIX3M/VIX ratio can suggest near-term stress." />: calm but watch rate-sensitive sectors.</p>
          <SourceFooter meta={mockMeta} />
        </Panel>
        <Panel>
          <SectionHeader title="Key Market Stats" subtitle="Compact right-side list with source mapping." />
          {keyMarketStats.map((metric) => <MetricRow key={metric.label} metric={metric} />)}
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel><SectionHeader title="Today’s Top News" subtitle="Featured Unusual Whales news belongs on Today." /><DataTable columns={[{key:"time",label:"Time"},{key:"headline",label:"Headline"},{key:"tickers",label:"Tags"},{key:"impact",label:"Impact"}]} rows={topNews} /><SourceFooter meta={{...mockMeta, source:"Unusual Whales Featured News", sourceUrl:"https://unusualwhales.com/news"}} /></Panel>
        <Panel><SectionHeader title="Today’s Earnings" subtitle="BMO / AMC expectations." /><DataTable columns={compactColumns} rows={earningsRows} /><SourceFooter meta={{...mockMeta, source:"Unusual Whales Earnings"}} /></Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel><SectionHeader title="Economic Calendar" /><DataTable columns={[{key:"time",label:"Time"},{key:"event",label:"Event"},{key:"actual",label:"Actual",align:"right"},{key:"forecast",label:"Forecast",align:"right"},{key:"previous",label:"Previous",align:"right"},{key:"importance",label:"Importance"}]} rows={economicRows} /></Panel>
        <Panel><SectionHeader title="Sector Performance Snapshot" subtitle="Sector ETF universe; true flow snapshot is a later phase." /><Heatmap tiles={sectorHeatmap.slice(0,6)} /></Panel>
      </div>
    </div>
  );
}
