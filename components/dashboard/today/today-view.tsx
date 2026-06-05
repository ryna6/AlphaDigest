import Link from "next/link";
import type { Metric } from "@/lib/data/schemas/common";
import type {
  EarningsEvent,
  EconomicEvent,
  FeaturedArticle,
  TodayPayload
} from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils/cn";
import { formatEtDateTime, formatEtTime, timestampTitle } from "@/lib/utils/time";

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
  if (time === "BMO") return "Before Open";
  if (time === "AMC") return "After Close";
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

function featuredArticleTime(article: FeaturedArticle) {
  return article.publishedAt ?? article.createdAt ?? article.fetchedAt;
}

export function FeaturedArticleList({
  articles,
  from,
  count
}: {
  articles: FeaturedArticle[];
  from: "today" | "top-news";
  count?: number;
}) {
  return (
    <div className="divide-y divide-borderStrong/60">
      {articles.map((article) => {
        const href = `/overview/today/top-news/${encodeURIComponent(article.slug)}?from=${from}${count ? `&count=${count}` : ""}`;
        const timestamp = featuredArticleTime(article);

        return (
          <article key={article.slug} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <Link
                href={href}
                className="min-w-0 flex-1 text-base font-semibold leading-snug text-textPrimary hover:text-accentBlue"
              >
                {article.title}
              </Link>
              {article.tags.length ? (
                <div className="flex max-w-[42%] shrink-0 flex-wrap justify-end gap-1.5 pt-0.5">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span
                      key={`${article.slug}-${tag}`}
                      className="border border-borderStrong px-2 py-0.5 text-[10px] uppercase tracking-wide text-textSecondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-textMuted" title={timestampTitle(timestamp)}>
              {formatEtDateTime(timestamp)}
            </p>
            {article.excerpt ? (
              <p className="mt-1 line-clamp-2 text-xs text-textSecondary">{article.excerpt}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function EarningsPanel({ earnings }: { earnings: EarningsEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Earnings" />
      {earnings.length ? (
        <div className="divide-y divide-borderStrong/60">
          {earnings.slice(0, 5).map((event) => (
            <div
              key={`${event.ticker}-${event.time}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent bg-cover bg-center bg-no-repeat text-[10px] font-bold text-textPrimary"
                  style={event.logoUrl ? { backgroundImage: `url(${event.logoUrl})` } : undefined}
                  aria-label={event.logoUrl ? `${event.company} logo` : undefined}
                >
                  {event.logoUrl ? null : event.ticker.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-textPrimary">{event.ticker}</p>
                  <p className="mt-1 truncate text-xs text-textMuted">{event.company}</p>
                </div>
              </div>
              <p className="shrink-0 text-right text-sm font-semibold text-textSecondary">
                {earningsTimeLabel(event.time)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-none border border-dashed border-borderStrong px-3 py-4 text-center text-xs text-textMuted">
          No major earnings today
        </div>
      )}
    </Panel>
  );
}

function EconomicEventsPanel({ events }: { events: EconomicEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Economic Events" />
      <div className="divide-y divide-borderStrong/60">
        {events.map((event) => (
          <div
            key={`${event.event}-${event.time}`}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-textPrimary">{event.event}</p>
              <p
                className="mt-1 text-xs leading-none tracking-[0.18em] text-textSecondary"
                aria-label={`${event.importance} importance`}
              >
                {importanceStars(event.importance)}
              </p>
            </div>
            <p
              className="shrink-0 text-right text-sm font-semibold text-textSecondary"
              title={timestampTitle(event.time)}
            >
              {formatEtTime(event.time)}
            </p>
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
      <PageTitle
        title="Today"
        subtitle="What matters today across backdrop, tape, catalysts, and risk."
      />
      <Panel>
        <SectionHeader title="Market Summary" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.marketSummary.map((metric) => {
            const explanation = roroExplanation(metric);

            return (
              <div
                key={metric.label}
                className="min-h-32 rounded-none border border-borderStrong bg-sidebar p-4"
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">
                    {metric.label}
                  </p>
                  {metric.label === "Risk-on / risk-off" ? (
                    <InfoTooltip text="Risk-on / risk-off compares VIX3M to VIX. A ratio above 1 means the 3-month volatility future is above spot VIX, which often signals a more cautious or risk-off tape; below 1 suggests near-term fear is elevated versus 3-month volatility and can indicate a risk-on setup as stress fades." />
                  ) : null}
                </div>
                <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
                {explanation ? (
                  <p className={cn("mt-2 text-sm", signedValueClass(explanation))}>{explanation}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <SectionHeader
            title="Top News"
            action={
              <Link
                href="/overview/today/top-news?count=20"
                className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
              >
                View All
              </Link>
            }
          />
          <FeaturedArticleList articles={data.featuredNews.slice(0, 8)} from="today" />
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
