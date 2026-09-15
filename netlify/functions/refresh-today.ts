import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "2,17,32,47 12-23 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-today", startedAt, snapshotKey: "today:latest" });
  try {
    const snapshot = await refreshDashboardSnapshot("today:latest");
    const ok = snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-today", snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok, error: snapshot.error });
    return json({ job: "refresh-today", startedAt, finishedAt: new Date().toISOString(), ok, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown today refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-today", error: message });
    return json({ ok: false, job: "refresh-today", startedAt, error: message }, 500);
  }
}
