import { todayMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

export function NewsCalendarView() {
  const latestNews = todayMock.featuredNews
    .concat(todayMock.featuredNews, todayMock.featuredNews, todayMock.featuredNews)
    .slice(0, 10);

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
            <button className="rounded-lg border border-borderStrong px-3 py-1 text-xs text-textSecondary">
              View All
            </button>
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
              {n.tickers.join(", ")}
            </p>
          </div>
        ))}
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Economic Calendar" />
          <DataTable
            rows={todayMock.economicCalendar.map((e) => ({
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
            rows={todayMock.earnings.map((e) => ({
              Ticker: e.ticker,
              Company: e.company,
              Time: e.time,
              EPS: e.expectedEps,
              Revenue: e.expectedRevenue ?? "—"
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
