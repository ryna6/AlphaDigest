import type { TodayPayload } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils/cn";

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

export function TodayView({ data }: { data: TodayPayload }) {
  return (
    <>
      <PageTitle title="Today" subtitle="What matters today across backdrop, tape, catalysts, and risk." />
      <Panel>
        <SectionHeader title="Market Summary" subtitle="Compact daily briefing cards" info="Risk-on / risk-off is calculated as VIX3M divided by VIX." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.marketSummary.map((metric) => (
            <div key={metric.label} className="min-h-32 rounded-xl border border-borderStrong bg-sidebar p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">{metric.label}</p>
              <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
              {metric.change ? <p className={cn("mt-2 text-sm", signedValueClass(metric.change))}>{metric.change}</p> : null}
            </div>
          ))}
        </div>
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Today's Top News" subtitle="Featured news from Unusual Whales only" />
          {data.featuredNews.map((n) => <div key={n.headline} className="border-b border-borderStrong py-3 last:border-b-0"><p className="text-sm font-medium">{n.headline}</p><p className="mt-1 text-xs text-textMuted">{n.timestamp} • {n.tickers.join(", ")}</p><p className="mt-1 text-xs text-textSecondary">{n.whyItMatters}</p></div>)}
        </Panel>
        <Panel>
          <SectionHeader title="Today’s Earnings & Economic Calendar" />
          <div className="grid gap-4">
            <DataTable rows={data.earnings.map((e) => ({ Ticker: e.ticker, Company: e.company, Time: e.time, EPS: e.expectedEps, Revenue: e.expectedRevenue ?? "—" }))} />
            <DataTable rows={data.economicCalendar.map((e) => ({ Time: e.time, Event: e.event, Actual: e.actual ?? "—", Forecast: e.forecast ?? "—", Previous: e.previous ?? "—", Importance: e.importance }))} />
          </div>
        </Panel>
      </div>
      <Panel className="mt-4">
        <SectionHeader title="Sector Performance Snapshot" subtitle="MVP sector ETF universe until true flow methodology is available" />
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {data.sectorSnapshot.map((m) => <div key={m.label} className="rounded-xl border border-borderStrong bg-sidebar p-3"><p className="text-xs text-textMuted">{m.label}</p><p className={cn("mt-2 text-lg font-semibold", signedValueClass(m.value))}>{m.value}</p></div>)}
        </div>
      </Panel>
    </>
  );
}
