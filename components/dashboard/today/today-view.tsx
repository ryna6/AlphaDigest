import type { EarningsEvent, TodayPayload } from "@/lib/data/schemas/dashboard";
import type { Metric } from "@/lib/data/schemas/common";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { MetricRow } from "@/components/ui/metric-row";
import { cn } from "@/lib/utils/cn";

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

function SummaryMetricCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-h-32 rounded-xl border border-borderStrong bg-sidebar p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">{metric.label}</p>
          <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
          {metric.change ? <p className={cn("mt-2 text-sm", signedValueClass(metric.change))}>{metric.change}</p> : null}
        </div>
      ))}
    </div>
  );
}

function EarningsRow({ event }: { event: EarningsEvent }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-borderStrong/60 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-textPrimary">{event.ticker}</p>
        <p className="truncate text-xs text-textMuted">{event.company} • Earnings</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-textSecondary">{event.time}</p>
    </div>
  );
}

export function TodayView({ data }: { data: TodayPayload }) {
  return (
    <>
      <PageTitle title="Today" subtitle="What matters today across backdrop, tape, catalysts, and risk." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_450px]">
        <Panel>
          <SectionHeader title="Market Summary" subtitle={data.summary.regime} info="Risk-on / risk-off is calculated as VIX3M divided by VIX." />
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-textPrimary">{data.summary.title}</h2>
              <div className="mt-5 grid gap-3">
                {data.summary.bullets.map((bullet) => (
                  <p key={bullet} className="rounded-xl border border-borderStrong bg-bg px-4 py-3 text-sm text-textSecondary md:text-base">
                    {bullet}
                  </p>
                ))}
              </div>
            </div>
            <SummaryMetricCards metrics={data.marketSummary} />
          </div>
        </Panel>
        <div className="grid gap-4 self-start">
          <Panel>
            <SectionHeader title="Key Market Stats" subtitle="Compact cross-asset snapshot" />
            <div>{data.keyStats.map((metric) => <MetricRow key={metric.label} metric={metric} />)}</div>
          </Panel>
          <Panel>
            <SectionHeader title="Today’s Earnings" subtitle="Ticker, company, event, and report time" />
            <div>{data.earnings.map((event) => <EarningsRow key={`${event.ticker}-${event.time}`} event={event} />)}</div>
          </Panel>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Today's Top News" subtitle="Featured news from Unusual Whales only" />
          {data.featuredNews.map((n) => (
            <div key={n.headline} className="border-b border-borderStrong py-3 last:border-b-0">
              <p className="text-sm font-medium">{n.headline}</p>
              <p className="mt-1 text-xs text-textMuted">{n.timestamp} • {n.tickers.join(", ")}</p>
              <p className="mt-1 text-xs text-textSecondary">{n.whyItMatters}</p>
            </div>
          ))}
        </Panel>
        <Panel>
          <SectionHeader title="Today’s Economic Calendar" />
          <DataTable rows={data.economicCalendar.map((e) => ({ Time: e.time, Event: e.event, Actual: e.actual ?? "—", Forecast: e.forecast ?? "—", Previous: e.previous ?? "—", Importance: e.importance }))} />
        </Panel>
      </div>
    </>
  );
}
