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
  return "☆".repeat(count);
}

function earningsTimeLabel(time: EarningsEvent["time"]) {
  if (time === "BMO") return "Before open";
  if (time === "AMC") return "After close";
  return "TBD";
}

function roroExplanation(metric: Metric) {
  if (metric.label !== "Risk-on / risk-off") return metric.change;

  const ratio = Number(metric.value);
  if (!Number.isFinite(ratio)) return metric.change;
  if (ratio > 1) return "Risk Off";
  if (ratio < 1) return "Risk On";
  return "neutral";
}

function economicEventTimeLabel(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*ET)?$/i);
  if (!match) return time;

  const hour = Number(match[1]);
  if (!Number.isFinite(hour)) return time;

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour.toString().padStart(2, "0")}:${match[2]} ${period}`;
}

function EarningsPanel({ earnings }: { earnings: EarningsEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Earnings" />
      <div className="divide-y divide-borderStrong/60">
        {earnings.map((event) => (
          <div key={`${event.ticker}-${event.time}`} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-textPrimary">{event.ticker}</p>
              <p className="mt-1 truncate text-xs text-textMuted">{event.company}</p>
            </div>
            <p className="shrink-0 text-right text-sm font-semibold text-textSecondary">{earningsTimeLabel(event.time)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EconomicEventsPanel({ events }: { events: EconomicEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Economic Events" />
      <div className="divide-y divide-borderStrong/60">
        {events.map((event) => (
          <div key={`${event.event}-${event.time}`} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-textPrimary">{event.event}</p>
              <p className="mt-1 text-lg leading-none text-textSecondary" aria-label={`${event.importance} importance`}>
                {importanceStars(event.importance)}
              </p>
            </div>
            <p className="shrink-0 text-right text-sm font-semibold text-textSecondary">{economicEventTimeLabel(event.time)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function KeyStatsPanel({ stats }: { stats: Metric[] }) {
  return (
    <Panel>
      <SectionHeader title="Market Overview" />
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
        <SectionHeader title="Market Summary" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.marketSummary.map((metric) => {
            const explanation = roroExplanation(metric);

            return (
              <div key={metric.label} className="min-h-32 rounded-xl border border-borderStrong bg-sidebar p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">{metric.label}</p>
                <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
                {explanation ? <p className={cn("mt-2 text-sm", signedValueClass(explanation))}>{explanation}</p> : null}
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <SectionHeader title="Top News" />
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
