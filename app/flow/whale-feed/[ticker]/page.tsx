import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { WhaleFeedTable } from "@/components/dashboard/flow/whale-feed-table";
import { getWhaleTradesPayload } from "@/lib/data/live-dashboard";

export default async function WhaleFeedTickerPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const { payload } = await getWhaleTradesPayload(ticker);
  return (
    <>
      <PageTitle title={`${ticker} Whale Feed`} subtitle="Ticker-specific cached Whale Feed trades." />
      <Panel>
        <SectionHeader title={`${ticker} Whale Feed Trades`} action={<FlowBackLink href="/flow/whale-feed" />} />
        <WhaleFeedTable rows={payload.rows} linkTickers={false} />
      </Panel>
    </>
  );
}
