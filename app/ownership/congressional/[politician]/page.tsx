import { PageTitle } from "@/components/dashboard/page-title";
import { CongressionalHoldingsCard } from "@/components/dashboard/ownership/congressional-holdings-card";
import { Panel } from "@/components/ui/panel";

export default function PoliticianPage({ params }: { params: { politician: string } }) {
  return <><PageTitle title="Politician Detail" /><Panel><CongressionalHoldingsCard mode="detail" politicianSlug={params.politician} /></Panel></>;
}
