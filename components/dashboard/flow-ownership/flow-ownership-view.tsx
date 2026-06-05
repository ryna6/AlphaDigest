import { flowMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { DataTable } from "@/components/ui/data-table";

export function FlowOwnershipView() {
  return (
    <>
      <PageTitle title="Flow & Ownership" />
      <Panel>
        <SectionHeader
          title="Big Money Flow Summary"
          subtitle="Flow window: trailing 7 days. 13F window: latest reported quarter."
          action={
            <div className="rounded-full border border-borderStrong p-1 text-xs">
              <span className="rounded-full bg-accentBlue/10 px-2 py-1 text-accentBlue">7D</span>
              <span className="px-2 py-1 text-textMuted">30D</span>
            </div>
          }
        />
        {flowMock.summary.map((m) => (
          <MetricRow key={m.label} metric={m} />
        ))}
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Dark Pool" />
          <DataTable rows={flowMock.darkPool} />
        </Panel>
        <Panel>
          <SectionHeader title="Whale Trades" />
          <DataTable rows={flowMock.whaleTrades} />
        </Panel>
        <Panel>
          <SectionHeader title="Insider Trades" />
          <DataTable rows={flowMock.insiderTrades} />
        </Panel>
        <Panel>
          <SectionHeader
            title="Congressional Trades"
            subtitle="Disclosure date may lag trade date."
          />
          <DataTable rows={flowMock.congressionalTrades} />
        </Panel>
      </div>
      <Panel className="mt-4">
        <SectionHeader
          title="Institutional Positioning"
          subtitle="Latest 13F data, not live trading flow."
          info="13F filings are quarterly and delayed, so this data is institutional positioning rather than current trading flow."
        />
        <DataTable rows={flowMock.institutionalPositioning} />
      </Panel>
    </>
  );
}
