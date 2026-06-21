import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { WhaleFeedViewMore } from "@/components/dashboard/flow/whale-feed-view-more";
import { getWhaleTradesPayload } from "@/lib/data/live-dashboard";

export default async function WhaleFeedPage() {
  const { payload } = await getWhaleTradesPayload();
  return <><PageTitle title="Whale Feed" /><Panel><SectionHeader title="Top Whale Trades" action={<FlowBackLink href="/flow" />} /><WhaleFeedViewMore rows={payload.rows} /></Panel></>;
}
