import { TodayView } from "@/components/dashboard/today/today-view";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";

export const revalidate = 60;

export default async function TodayPage() {
  const result = await getServingDashboardSnapshot("today:latest");
  return result.ok ? <TodayView data={result.payload} /> : <SnapshotUnavailable title="Today" />;
}
