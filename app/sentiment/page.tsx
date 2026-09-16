import { SentimentView } from "@/components/dashboard/sentiment/sentiment-view";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";

export const revalidate = 1800;

export default async function SentimentPage() {
  const result = await getServingDashboardSnapshot("sentiment:latest");
  return result.ok ? (
    <SentimentView data={result.payload} />
  ) : (
    <SnapshotUnavailable title="Sentiment" />
  );
}
