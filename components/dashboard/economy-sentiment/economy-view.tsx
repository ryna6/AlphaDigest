import { getEconomyPayload } from "@/lib/data/economy";
import { PageTitle } from "@/components/dashboard/page-title";
import { EconomyCardGrid } from "./economy-card-grid";

export async function EconomyView() {
  const { payload } = await getEconomyPayload();
  return (
    <>
      <PageTitle title="Economy" />
      <EconomyCardGrid summaryCards={payload.summaryCards} mainCards={payload.mainCards} />
    </>
  );
}
