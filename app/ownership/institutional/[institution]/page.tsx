import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { InstitutionalCard } from "@/components/dashboard/ownership/institutional-card";

export default function InstitutionDetailPage({ params }: { params: { institution: string } }) {
  return (
    <>
      <PageTitle
        title="Institution Detail"
        subtitle="Tracked institutional holdings, options, and activity."
      />
      <Panel>
        <InstitutionalCard mode="detail" institutionSlug={params.institution} />
      </Panel>
    </>
  );
}
