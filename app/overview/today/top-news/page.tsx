import { getTodayPayload } from "@/lib/data/live-dashboard";
import { TopNewsListClient } from "./top-news-list-client";

export const dynamic = "force-dynamic";

export default async function TopNewsPage({ searchParams }: { searchParams?: { count?: string } }) {
  const { payload } = await getTodayPayload();
  const requestedCount = Number(searchParams?.count ?? 20);
  const initialCount = Number.isFinite(requestedCount) ? requestedCount : 20;

  return (
    <TopNewsListClient articles={payload.featuredNews.slice(0, 50)} initialCount={initialCount} />
  );
}
