import { getOwnershipPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { InstitutionalSummary } from "./institutional-summary";
import { InstitutionalCard } from "./institutional-card";

const hiddenOwnershipNotices = new Set([
  "Institutional ownership is sourced from the tracked 13F cache."
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
        <InstitutionalCard />
      </Panel>
    </>
  );
}
