import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { DarkPoolViewMore } from "@/components/dashboard/flow/dark-pool-view-more";
import { getDarkPoolPayload } from "@/lib/data/live-dashboard";

export default async function DarkPoolPage() {
  const { payload } = await getDarkPoolPayload(100);
  return (
    <>
      <PageTitle title="Dark Pool" subtitle="Large cached dark pool prints sorted by premium." />
      <Panel>
        <SectionHeader title="Top Dark Pool Prints" action={<FlowBackLink href="/flow" />} />
        <DarkPoolViewMore rows={payload.rows} />
      </Panel>
    </>
  );
}
