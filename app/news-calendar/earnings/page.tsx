import { AllEarningsView } from "@/components/dashboard/news-calendar/news-calendar-view";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";

export const revalidate = 180;

export default async function AllEarningsPage() {
  const result = await getServingDashboardSnapshot("news-calendar:latest");
  return result.ok ? (
    <AllEarningsView data={result.payload} />
  ) : (
    <SnapshotUnavailable title="Earnings" />
  );
}
