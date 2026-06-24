import { getOwnershipPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { InstitutionalSummary } from "./institutional-summary";

const hiddenOwnershipNotices = new Set([
  "Institutional/13F and Congressional sections remain fixture-backed until live providers are added."
]);

export async function OwnershipView() {
  const { payload } = await getOwnershipPayload();
  const visibleNotices = payload.notices.filter((notice) => !hiddenOwnershipNotices.has(notice));
  return (
    <>
      <PageTitle title="Ownership" />
      {visibleNotices.length ? (
        <p className="mb-3 border border-borderStrong bg-sidebar p-3 text-xs text-textMuted">
          {visibleNotices.join(" ")}
        </p>
      ) : null}
      <Panel>
        <InstitutionalSummary />
      </Panel>
      <Panel className="mt-4">
        <SectionHeader
          title="Institutional"
          subtitle="Fixture-backed placeholder; 13F filings are quarterly and delayed."
          info="No live institutional/13F endpoint was provided for this task."
        />
        <DataTable rows={payload.institutionalPositioning} />
      </Panel>
      <Panel className="mt-4">
        <SectionHeader
          title="Congressional Trades"
          subtitle="Fixture-backed placeholder; disclosure date may lag trade date."
          info="No live congressional trades endpoint was provided for this task."
        />
        <DataTable rows={payload.congressionalTrades} />
      </Panel>
    </>
  );
}
