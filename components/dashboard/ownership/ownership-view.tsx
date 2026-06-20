import { getOwnershipPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

export async function OwnershipView() {
  const { payload } = await getOwnershipPayload();
  return <><PageTitle title="Ownership" />{payload.notices.length ? <p className="mb-3 border border-borderStrong bg-sidebar p-3 text-xs text-textMuted">{payload.notices.join(" ")}</p> : null}<Panel><SectionHeader title="Institutional / 13F Positioning" subtitle="Fixture-backed placeholder; 13F filings are quarterly and delayed." info="No live institutional/13F endpoint was provided for this task." /><DataTable rows={payload.institutionalPositioning} /></Panel><Panel className="mt-4"><SectionHeader title="Congressional Trades" subtitle="Fixture-backed placeholder; disclosure date may lag trade date." info="No live congressional trades endpoint was provided for this task." /><DataTable rows={payload.congressionalTrades} /></Panel></>;
}
