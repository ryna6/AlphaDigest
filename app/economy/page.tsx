import { EconomyView } from "@/components/dashboard/economy/economy-view";
import { RouteDataReady } from "@/components/shell/route-data-ready";
import { getEconomyPayload } from "@/lib/data/economy";

export const dynamic = "force-dynamic";

export default async function EconomyPage() {
  const { payload } = await getEconomyPayload();
  return <><EconomyView payload={payload} /><RouteDataReady routeKey="/economy" /></>;
}
