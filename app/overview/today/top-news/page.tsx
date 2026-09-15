import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";
import { TopNewsListClient } from "./top-news-list-client";

export const revalidate = 180;

export default async function TopNewsPage({ searchParams }: { searchParams?: { count?: string } }) {
  const result = await getServingDashboardSnapshot("today:latest");
  if (!result.ok) return <SnapshotUnavailable title="Top News" />;
  const payload = result.payload;
  const requestedCount = Number(searchParams?.count ?? 20);
  const initialCount = Number.isFinite(requestedCount) ? requestedCount : 20;

  return (
    <TopNewsListClient articles={payload.featuredNews.slice(0, 50)} initialCount={initialCount} />
  );
}
