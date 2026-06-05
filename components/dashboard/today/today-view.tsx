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

function importanceStars(importance: EconomicEvent["importance"]) {
  const count = { Low: 1, Medium: 2, High: 3 }[importance];
  return "★".repeat(count);
}

function EarningsPanel({ earnings }: { earnings: EarningsEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Today’s Earnings" subtitle="Ticker, company, and report time" />
      <div className="divide-y divide-borderStrong/60">
        {earnings.map((event) => (
          <div key={`${event.ticker}-${event.time}`} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-textPrimary">{event.ticker}</p>
              <p className="mt-1 truncate text-xs text-textMuted">{event.company}</p>
            </div>
            <p className="shrink-0 text-right text-sm font-semibold text-textSecondary">{event.time}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EconomicEventsPanel({ events }: { events: EconomicEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Economic Events" subtitle="Event, importance, and time" />
      <div className="divide-y divide-borderStrong/60">
        {events.map((event) => (
          <div key={`${event.event}-${event.time}`} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-textPrimary">{event.event}</p>
              <p className="mt-1 text-xs text-warning" aria-label={`${event.importance} importance`}>
                {importanceStars(event.importance)}
              </p>
            </div>
            <p className="shrink-0 text-right text-sm font-semibold text-textSecondary">{event.time}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
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
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
        <aside className="space-y-4">
          <KeyStatsPanel stats={data.keyStats} />
          <EarningsPanel earnings={data.earnings} />
          <EconomicEventsPanel events={data.economicCalendar} />
        </aside>
      </div>
    </>
  );
}
