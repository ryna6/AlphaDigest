import { PageTitle } from "@/components/dashboard/page-title";
import { CongressionalHoldingsCard } from "@/components/dashboard/ownership/congressional-holdings-card";
import { Panel } from "@/components/ui/panel";

export default function PoliticianTickerPage({ params }: { params: { politician: string; ticker: string } }) {
  return <><PageTitle title="Politician Stock Trades" /><Panel><CongressionalHoldingsCard mode="ticker" politicianSlug={params.politician} ticker={params.ticker} /></Panel></>;
}
