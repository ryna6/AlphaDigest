import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

// Run after the two source owners (:06 and :07). This function only assembles
// their cached rows, so a snapshot refresh cannot duplicate provider/upsert work.
export const config = { schedule: "8,38 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-news", startedAt, snapshotKey: "news-calendar:latest" });
  try {
    const snapshot = await refreshDashboardSnapshot("news-calendar:latest");
    const ok = snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-news", snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok, error: snapshot.error });
    return json({ job: "refresh-news", startedAt, finishedAt: new Date().toISOString(), ok, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news/calendar refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-news", error: message });
    return json({ ok: false, job: "refresh-news", startedAt, error: message }, 500);
  }
}
