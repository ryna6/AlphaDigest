import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { InstitutionalCard } from "@/components/dashboard/ownership/institutional-card";

export default function InstitutionalListPage() {
  return (
    <>
      <PageTitle title="Institutional" subtitle="Tracked institutional ownership list." />
      <Panel>
        <InstitutionalCard mode="list" />
      </Panel>
    </>
  );
}
