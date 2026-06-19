import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "*/15 12-23 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  try {
    const result = await refreshDashboardSnapshot("today:latest");
    return json({ job: "refresh-today", ...result, generatedAt: new Date().toISOString() }, result.ok ? 200 : 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown today refresh error";
    console.error("dashboard_snapshot_refresh_error", { key: "today:latest", error: message });
    return json({ ok: false, job: "refresh-today", error: message }, 500);
  }
}
