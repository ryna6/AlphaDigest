import { refreshInvestingEconomicEvents } from "../../lib/data/adapters/investing-economic-calendar";
import { refreshUnusualWhalesFeaturedArticles } from "../../lib/data/adapters/unusual-whales-news";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "*/15 12-23 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-today", startedAt, sources: ["unusual_whales_featured_articles", "investing_economic_events"], snapshotKey: "today:latest" });
  try {
    const [featuredArticles, economicEvents] = await Promise.all([
      refreshUnusualWhalesFeaturedArticles(50),
      refreshInvestingEconomicEvents()
    ]);
    const snapshot = await refreshDashboardSnapshot("today:latest");
    const ok = featuredArticles.ok && economicEvents.ok && snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-today", featuredRows: featuredArticles.count, featuredUpserted: featuredArticles.upserted ?? 0, economicRows: economicEvents.count, economicUpserted: economicEvents.upserted ?? 0, snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok });
    return json({ job: "refresh-today", startedAt, finishedAt: new Date().toISOString(), ok, featuredArticles, economicEvents, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown today refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-today", error: message });
    return json({ ok: false, job: "refresh-today", startedAt, error: message }, 500);
  }
}
