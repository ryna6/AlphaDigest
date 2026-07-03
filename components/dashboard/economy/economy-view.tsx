import { PageTitle } from "@/components/dashboard/page-title";
import { economyMainCards, economySummaryCards } from "@/lib/data/economy-config";
import { EconomyCardGrid } from "./economy-card-grid";

export function EconomyView() {
  return (
    <>
      <PageTitle title="Economy" />
      <EconomyCardGrid summaryCards={economySummaryCards} mainCards={economyMainCards} />
    </>
  );
}
