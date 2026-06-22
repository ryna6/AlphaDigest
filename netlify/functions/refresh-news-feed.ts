import { refreshUnusualWhalesNewsFeed } from "../../lib/data/adapters/unusual-whales-news";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "10,40 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  console.log("scheduled_refresh_start", { job: "refresh-news-feed", source: "unusual_whales_news_feed", startedAt, limit });
  const runId = await startJobRun({ jobName: "Unusual Whales News Feed", functionName: "refresh-news-feed", source: "Unusual Whales" });
  try {
    const result = await refreshUnusualWhalesNewsFeed(Number.isFinite(limit) ? limit : 100);
    console.log("scheduled_refresh_complete", { job: "refresh-news-feed", rowsFetched: result.count, rowsUpserted: result.upserted ?? 0, persisted: result.persisted, ok: result.ok, error: result.error });
    await finishJobRun(runId, { status: result.ok && (result.count ?? 0) > 0 ? "success" : result.ok ? "warning" : "error", rowsFetched: result.count ?? null, rowsInserted: result.upserted ?? null, errorMessage: result.ok ? null : result.error, warningMessage: result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null, metadata: { persisted: result.persisted } });
    return json({ job: "refresh-news-feed", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news feed refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-news-feed", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-news-feed", startedAt, error: message }, 500);
  }
}
