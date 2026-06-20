import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { refreshUnusualWhalesFeaturedArticles, refreshUnusualWhalesNewsFeed } from "../../lib/data/adapters/unusual-whales-news";

export const config = { schedule: "*/30 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-news", startedAt, sources: ["unusual_whales_news_feed", "unusual_whales_featured_articles"], snapshotKey: "news-calendar:latest" });
  try {
    const [newsFeed, featuredArticles] = await Promise.all([
      refreshUnusualWhalesNewsFeed(100),
      refreshUnusualWhalesFeaturedArticles(50)
    ]);
    const dependenciesOk = newsFeed.ok && featuredArticles.ok;
    const snapshot = dependenciesOk
      ? await refreshDashboardSnapshot("news-calendar:latest")
      : { key: "news-calendar:latest", ok: false, persisted: false, error: "Skipped snapshot because source upserts failed." };
    const ok = dependenciesOk && snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-news", newsRows: newsFeed.count, newsUpserted: newsFeed.upserted ?? 0, featuredRows: featuredArticles.count, featuredUpserted: featuredArticles.upserted ?? 0, snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok, error: ok ? null : snapshot.error ?? newsFeed.error ?? featuredArticles.error });
    return json({ job: "refresh-news", startedAt, finishedAt: new Date().toISOString(), ok, newsFeed, featuredArticles, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news/calendar refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-news", error: message });
    return json({ ok: false, job: "refresh-news", startedAt, error: message }, 500);
  }
}
