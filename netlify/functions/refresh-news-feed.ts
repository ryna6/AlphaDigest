import { refreshUnusualWhalesNewsFeed } from "../../lib/data/adapters/unusual-whales-news";

export const config = { schedule: "10,40 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  console.log("scheduled_refresh_start", { job: "refresh-news-feed", source: "unusual_whales_news_feed", startedAt, limit });
  try {
    const result = await refreshUnusualWhalesNewsFeed(Number.isFinite(limit) ? limit : 100);
    console.log("scheduled_refresh_complete", { job: "refresh-news-feed", rowsFetched: result.count, rowsUpserted: result.upserted ?? 0, persisted: result.persisted, ok: result.ok, error: result.error });
    return json({ job: "refresh-news-feed", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news feed refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-news-feed", error: message });
    return json({ ok: false, job: "refresh-news-feed", startedAt, error: message }, 500);
  }
}
