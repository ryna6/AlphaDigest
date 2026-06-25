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

const putCallInfoText =
  "This metric compares the trading volume (or open interest) of put options to call options.\n\nWhen the ratio > 1.2, it suggests traders are buying significantly more puts than calls, reflecting a more bearish sentiment. When the ratio < 0.7, it suggests traders are buying more calls than puts, reflecting a more bullish sentiment.";

function formatPutCallRatio(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--";
}

function putCallSentimentClass(value?: string) {
  if (value === "Bearish") return "text-negative";
  if (value === "Bullish") return "text-positive";
  return "text-textSecondary";
}

function putCallLines(metric: Metric) {
  if (metric.putCallRatios) {
    console.log("today_put_call_card", {
      hasRatios: true,
      presentRatios: Object.entries(metric.putCallRatios)
        .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
        .map(([key]) => key),
      asOf: metric.putCallAsOf,
      freshness: metric.putCallFreshness
    });
    return [`Total: ${formatPutCallRatio(metric.putCallRatios.total)}`];
  }

  console.log("today_put_call_card", { hasRatios: false, asOf: metric.putCallAsOf });
  const lines = metric.value.split("\n");
  return [lines.find((line) => line.startsWith("Total:")) ?? lines[0] ?? "Total: --"];
}

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

function importanceStars(importance: EconomicEvent["importance"], stars?: EconomicEvent["stars"]) {
  const count = stars ?? { Low: 1, Medium: 2, High: 3 }[importance];
  return "★".repeat(count);
}

function earningsTimeLabel(time: EarningsEvent["time"]) {
  if (time === "BMO") return "Before Open";
  if (time === "AMC") return "After Close";
  return "TBD";
}

function roroExplanation(metric: Metric) {
  if (metric.label !== "Risk On Risk Off" && metric.label !== "Risk On / Risk Off")
    return metric.change;

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
      <SectionHeader title="Today's Earnings" />
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
          No earnings
        </div>
      )}
    </Panel>
  );
}

function EconomicEventsPanel({ events }: { events: EconomicEvent[] }) {
  return (
    <Panel>
      <SectionHeader title="Today's Economic Events" />
      {events.length ? (
        <div className="divide-y divide-borderStrong/60">
          {events.map((event) => (
            <div
              key={`${event.event}-${event.time}`}
              className={cn(
                "flex items-center justify-between gap-4 px-3 py-3",
                event.isHighlighted &&
                  "bg-accentBlue/10 shadow-[inset_3px_0_0_rgba(56,189,248,0.95)] ring-1 ring-inset ring-accentBlue/25"
              )}
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm font-semibold text-textPrimary",
                    event.isHighlighted && "font-bold text-white"
                  )}
                >
                  {event.event}
                </p>
                <p
                  className="mt-1 text-xs leading-none tracking-[0.18em] text-textSecondary"
                  aria-label={`${event.importance} importance`}
                >
                  {importanceStars(event.importance, event.stars)}
                </p>
              </div>
              <p
                className="shrink-0 text-right text-sm font-semibold text-textSecondary"
                title={timestampTitle(event.time)}
              >
                {formatEtTime(event.timestamp ?? event.time)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-none border border-dashed border-borderStrong px-3 py-4 text-center text-xs text-textMuted">
          No economic events
        </div>
      )}
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
      <PageTitle title="Today" />
      <Panel>
        <SectionHeader title="Market Summary" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.marketSummary.map((metric) => {
            const explanation = roroExplanation(metric);
            const isRiskOnRiskOff =
              metric.label === "Risk On Risk Off" || metric.label === "Risk On / Risk Off";
            const isLeadingSectors = metric.label === "Leading Sectors";
            const isPutCallRatio = metric.label === "Put/Call Ratio";
            const displayLabel = isRiskOnRiskOff ? "Risk On / Risk Off" : metric.label;

            return (
              <div
                key={metric.label}
                className="flex min-h-32 flex-col rounded-none border border-borderStrong bg-sidebar p-4"
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">
                    {displayLabel}
                  </p>
                  {isRiskOnRiskOff ? (
                    <InfoTooltip
                      text={
                        "This metric compares the 3-month expected volatility (VIX3M) to the current VIX.\n\nWhen the ratio > 1, it means traders expect higher volatility in the future, which can reflects a more risk-off market. When the ratio < 1, near-term fear is higher, which can suggest conditions is shifting towards a more risk-on market."
                      }
                      placement="right"
                    />
                  ) : null}
                  {isPutCallRatio ? <InfoTooltip text={putCallInfoText} placement="right" /> : null}
                </div>
                <div
                  className={cn("flex flex-1 flex-col justify-center", isLeadingSectors && "mt-4")}
                >
                  {isPutCallRatio ? (
                    <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-base font-semibold leading-tight text-textPrimary">
                      <span className="min-w-0 truncate">{putCallLines(metric)[0]}</span>
                      {metric.changePercent ? (
                        <span className={cn("shrink-0 text-right text-sm", signedValueClass(metric.changePercent))}>
                          {metric.changePercent}
                        </span>
                      ) : null}
                    </div>
                  ) : isRiskOnRiskOff ? (
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <p className="text-2xl font-semibold text-textPrimary">{metric.value}</p>
                      {metric.changePercent ? (
                        <span className={cn("shrink-0 text-right text-sm font-semibold", signedValueClass(metric.changePercent))}>
                          {metric.changePercent}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p
                      className={cn(
                        "font-semibold text-textPrimary",
                        isLeadingSectors ? "text-[1.2rem] leading-tight" : "text-2xl"
                      )}
                    >
                      {metric.value}
                    </p>
                  )}
                  {explanation ? (
                    <p
                      className={cn(
                        "mt-2",
                        isLeadingSectors ? "text-[0.7rem]" : "text-sm",
                        isPutCallRatio ? putCallSentimentClass(explanation) : signedValueClass(explanation)
                      )}
                    >
                      {explanation}
                    </p>
                  ) : null}
                </div>
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
          <EconomicEventsPanel events={data.economicCalendar} />
          <EarningsPanel earnings={data.earnings} />
        </aside>
      </div>
    </>
  );
}
