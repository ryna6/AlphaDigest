import type { Metric } from "@/lib/data/schemas/common";
import type { EarningsEvent, EconomicEvent, TodayPayload } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { cn } from "@/lib/utils/cn";

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

function formatEarningsRow(event: EarningsEvent) {
  return {
    key: `earnings-${event.ticker}-${event.time}`,
    title: event.ticker,
    subtitle: `${event.company} • Earnings`,
    time: event.time
  };
}

function formatEconomicRow(event: EconomicEvent) {
  return {
    key: `economic-${event.event}-${event.time}`,
    title: event.event,
    subtitle: `${event.importance} impact economic event`,
    time: event.time
  };
}

function KeyStatsPanel({ stats }: { stats: Metric[] }) {
  return (
    <Panel>
      <SectionHeader title="Key Market Stats" subtitle="Compact cross-asset snapshot" />
      <div className="divide-y divide-borderStrong/60">
        {stats.map((metric) => (
          <MetricRow key={metric.label} metric={metric} />
        ))}
      </div>
    </Panel>
  );
}

export function TodayView({ data }: { data: TodayPayload }) {
  const calendarRows = [...data.earnings.map(formatEarningsRow), ...data.economicCalendar.map(formatEconomicRow)];

  return (
    <>
      <PageTitle title="Today" subtitle="What matters today across backdrop, tape, catalysts, and risk." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel>
            <SectionHeader title="Market Summary" subtitle="Compact daily briefing cards" info="Risk-on / risk-off is calculated as VIX3M divided by VIX." />
            <div className="grid gap-3 md:grid-cols-2">
              {data.marketSummary.map((metric) => (
                <div key={metric.label} className="min-h-32 rounded-xl border border-borderStrong bg-sidebar p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">{metric.label}</p>
                  <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
                  {metric.change ? <p className={cn("mt-2 text-sm", signedValueClass(metric.change))}>{metric.change}</p> : null}
                </div>
              ))}
            </div>
          </Panel>
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
        </div>
        <aside className="space-y-4">
          <KeyStatsPanel stats={data.keyStats} />
          <Panel>
            <SectionHeader title="Today’s Earnings & Economic Events" subtitle="Ticker, company/event, and time" />
            <div className="divide-y divide-borderStrong/60">
              {calendarRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-textPrimary">{row.title}</p>
                    <p className="mt-1 truncate text-xs text-textMuted">{row.subtitle}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold text-textSecondary">{row.time}</p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
