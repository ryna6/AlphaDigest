import { AllNewsView } from "@/components/dashboard/news-calendar/news-calendar-view";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";

export const revalidate = 180;

export default async function AllNewsPage() {
  const result = await getServingDashboardSnapshot("news-calendar:latest");
  return result.ok ? <AllNewsView data={result.payload} /> : <SnapshotUnavailable title="News" />;
}
