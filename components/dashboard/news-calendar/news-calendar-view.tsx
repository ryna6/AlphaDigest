import type { NewsCalendarPayload } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

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
              Importance: e.importance
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
