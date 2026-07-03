import { PageTitle } from "@/components/dashboard/page-title";
import { economyMainCards, economySummaryCards } from "@/lib/data/economy-config";
import { EconomyLoader } from "./economy-loader";

export function EconomyView() {
  return (
    <>
      <PageTitle title="Economy" />
      <EconomyLoader summaryCards={economySummaryCards} mainCards={economyMainCards} />
    </>
  );
}
