import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { InsiderCompaniesViewMore } from "@/components/dashboard/flow/insider-companies-view-more";
import { getInsiderTradesPayload } from "@/lib/data/live-dashboard";

export default async function InsiderTradesPage() {
  const { payload } = await getInsiderTradesPayload(50);
  return (
    <>
      <PageTitle title="Insider Trades" subtitle="Top insider-traded companies over the past 6 months." />
      <Panel>
        <SectionHeader title="Top Insider-Traded Companies" action={<FlowBackLink href="/flow" />} />
        <InsiderCompaniesViewMore companies={payload.companies} />
      </Panel>
    </>
  );
}
