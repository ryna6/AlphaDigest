import { PageTitle } from "@/components/dashboard/page-title";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricRow } from "@/components/ui/metric-row";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { tickerMock } from "@/lib/data/fixtures/mock-dashboard";

export function TickerExplorerView() {
  return (
    <>
      <PageTitle title="Ticker Explorer" />
      <Panel>
        <SectionHeader
          title="Ticker Snapshot Access"
          subtitle="MVP scaffold only; no live quote lookup is performed in the browser."
        />
        <EmptyState message="Ticker intelligence will load from internal API routes after scheduled ingestion populates cached snapshots. Mock data is never presented as live financial data." />
      </Panel>
    </>
  );
}

export function TickerDetailView({ symbol }: { symbol: string }) {
  const data = tickerMock(symbol);

  return (
    <>
      <PageTitle title={`${data.symbol} Intelligence`} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel>
          <SectionHeader
            title="Ticker Story"
            subtitle="Clearly labeled mock narrative; no live source calls."
          />
          <p className="text-sm leading-6 text-textSecondary">{data.story}</p>
        </Panel>
        <Panel>
          <SectionHeader title="Header Metrics" />
          {data.header.map((metric) => (
            <MetricRow key={metric.label} metric={metric} />
          ))}
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Catalyst Timeline" />
          <DataTable
            rows={data.timeline.map((item) => ({
              Time: item.timestamp,
              Headline: item.headline,
              Impact: item.impact ?? "—"
            }))}
          />
        </Panel>
        <Panel>
          <SectionHeader title="Flow & Ownership Context" />
          {data.flow.map((metric) => (
            <MetricRow key={metric.label} metric={metric} />
          ))}
          <div className="mt-3 border-t border-borderStrong pt-3">
            {data.ownership.map((metric) => (
              <MetricRow key={metric.label} metric={metric} />
            ))}
          </div>
        </Panel>
      </div>
      <Panel className="mt-4">
        <SectionHeader title="Sector Context" />
        {data.sectorContext.map((metric) => (
          <MetricRow key={metric.label} metric={metric} />
        ))}
      </Panel>
    </>
  );
}
