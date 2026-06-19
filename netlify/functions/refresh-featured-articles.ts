import { refreshUnusualWhalesFeaturedArticles } from "../../lib/data/adapters/unusual-whales-news";

export const config = { schedule: "20,50 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  console.log("scheduled_refresh_start", { job: "refresh-featured-articles", source: "unusual_whales_featured_articles", startedAt, limit });
  try {
    const result = await refreshUnusualWhalesFeaturedArticles(Number.isFinite(limit) ? limit : 50);
    console.log("scheduled_refresh_complete", { job: "refresh-featured-articles", rowsFetched: result.count, rowsUpserted: result.upserted ?? 0, persisted: result.persisted, ok: result.ok, error: result.error });
    return json({ job: "refresh-featured-articles", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown featured articles refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-featured-articles", error: message });
    return json({ ok: false, job: "refresh-featured-articles", startedAt, error: message }, 500);
  }
}
