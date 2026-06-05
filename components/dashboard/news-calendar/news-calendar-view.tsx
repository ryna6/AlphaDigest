import Link from "next/link";
import type { CalendarRange, CalendarRangeKey } from "@/lib/data/calendar-range";
import { calendarRangeKeys, getCalendarRange } from "@/lib/data/calendar-range";
import type { EconomicEvent, NewsCalendarPayload } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils/cn";

function importanceStars(importance: EconomicEvent["importance"]) {
  const count = { Low: 1, Medium: 2, High: 3 }[importance];
  return "☆".repeat(count);
}

function rangeHref(range: CalendarRangeKey) {
  return range === "this-week" ? "/news-calendar" : `/news-calendar?range=${range}`;
}

function RangeSelector({ selectedRange }: { selectedRange: CalendarRange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {calendarRangeKeys.map((range) => {
        const option = getCalendarRange(range);
        const selected = range === selectedRange.key;

        return (
          <Link
            key={range}
            href={rangeHref(range)}
            className={cn(
              "border border-borderStrong px-3 py-1 text-xs text-textSecondary transition hover:text-textPrimary",
              selected && "border-accentBlue text-accentBlue"
            )}
            aria-current={selected ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

export function NewsCalendarView({
  data,
  selectedRange
}: {
  data: NewsCalendarPayload;
  selectedRange: CalendarRange;
}) {
  const latestNews = data.news.slice(0, 10);

  return (
    <>
      <PageTitle
        title="News & Calendar"
        subtitle="What events and headlines are driving markets."
      />
      <Panel>
        <SectionHeader
          title="Latest Market News"
          action={
            <a
              href="https://unusualwhales.com/news-feed?limit=100&major_only=true"
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary"
              target="_blank"
              rel="noreferrer"
            >
              View All
            </a>
          }
        />
        {latestNews.map((n, i) => (
          <div
            key={`${n.headline}-${i}`}
            className="border-b border-borderStrong py-3 last:border-b-0"
          >
            <p className="text-sm font-medium">{n.headline}</p>
            <p className="mt-1 text-xs text-textMuted">
              {n.timestamp} • {n.category ?? "Market"} • impact {n.impact ?? "Medium"} •{" "}
              {n.tickers.length ? n.tickers.join(", ") : (n.source ?? "Unusual Whales")}
            </p>
          </div>
        ))}
      </Panel>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted">
          Calendar range: {selectedRange.label} ({selectedRange.minDate} to {selectedRange.maxDate})
        </p>
        <RangeSelector selectedRange={selectedRange} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Economic Calendar" />
          <DataTable
            rows={data.economicCalendar.map((e) => ({
              Date: e.date ?? "—",
              Time: e.time,
              Event: e.event,
              Actual: e.actual ?? "—",
              Forecast: e.forecast ?? "—",
              Previous: e.previous ?? "—",
              Importance: importanceStars(e.importance)
            }))}
          />
        </Panel>
        <Panel>
          <SectionHeader title="Earnings Calendar" />
          <DataTable
            rows={data.earnings.map((e) => ({
              Date: e.date ?? "—",
              Ticker: e.ticker,
              Company: e.company,
              Time: e.time,
              "EPS Forecast": e.epsForecast,
              "Actual EPS": e.actualEps ?? "—",
              "Revenue Forecast": e.revenueForecast ?? "—",
              "Actual Rev": e.actualRevenue ?? "—",
              "Market Cap": e.marketCap ?? "—"
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
