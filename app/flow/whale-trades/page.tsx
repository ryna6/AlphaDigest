import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { getWhaleTradesPayload } from "@/lib/data/live-dashboard";

export default async function WhaleTradesPage() {
  const { payload } = await getWhaleTradesPayload();
  return (
    <>
      <PageTitle
        title="Whale Trades"
        subtitle="Fixture-backed placeholder until a live endpoint is added."
      />
      <Panel>
        <SectionHeader title="Whale Trades" action={<FlowBackLink href="/flow" />} />
        <DataTable rows={payload.rows} />
      </Panel>
    </>
  );
}
