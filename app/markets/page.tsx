import { MarketsView } from "@/components/dashboard/markets/markets-view";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";

export const revalidate = 60;

export default async function MarketsPage() {
  const result = await getServingDashboardSnapshot("markets:latest");
  return result.ok ? (
    <MarketsView data={result.payload} />
  ) : (
    <SnapshotUnavailable title="Markets" />
  );
}
