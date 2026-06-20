import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { DarkPoolTable } from "@/components/dashboard/flow/dark-pool-table";
import { getDarkPoolPayload } from "@/lib/data/live-dashboard";

export default async function DarkPoolTickerPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const { payload } = await getDarkPoolPayload(100, ticker);
  return (
    <>
      <PageTitle
        title={`${ticker} Dark Pool`}
        subtitle="Ticker-specific cached dark pool prints."
      />
      <FlowBackLink href="/flow/dark-pool" />
      <Panel>
        <SectionHeader title={`${ticker} Dark Pool Prints`} />
        <DarkPoolTable rows={payload.rows} linkTickers={false} />
      </Panel>
    </>
  );
}
