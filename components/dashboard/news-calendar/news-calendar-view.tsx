import Link from "next/link";
import type { EconomicEvent, NewsCalendarPayload, NewsItem } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

function importanceStars(importance: EconomicEvent["importance"]) {
  const count = { Low: 1, Medium: 2, High: 3 }[importance];
  return "☆".repeat(count);
}

function NewsList({ news }: { news: NewsItem[] }) {
  return (
    <>
      {news.map((n, i) => (
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
    </>
  );
}

export function NewsCalendarView({ data }: { data: NewsCalendarPayload }) {
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
            <Link
              href="/news-calendar/news"
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary"
            >
              View All
            </Link>
          }
        />
        <NewsList news={latestNews} />
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Economic Calendar" />
          <DataTable
            rows={data.economicCalendar.map((e) => ({
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
              Ticker: e.ticker,
              Company: e.company,
              Time: e.time,
              "Expected EPS": e.expectedEps,
              "Actual EPS": e.actualEps ?? "—",
              "Expected Rev": e.expectedRevenue ?? "—",
              "Actual Rev": e.actualRevenue ?? "—"
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

export function AllNewsView({ data }: { data: NewsCalendarPayload }) {
  const news = data.news.slice(0, 100);

  return (
    <>
      <PageTitle
        title="Latest Market News"
        subtitle="The 100 most recent market headlines available to MarketRecap."
      />
      <Panel>
        <SectionHeader
          title="Most Recent 100 News"
          action={
            <Link
              href="/news-calendar"
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary"
            >
              Back
            </Link>
          }
        />
        <NewsList news={news} />
      </Panel>
    </>
  );
}
