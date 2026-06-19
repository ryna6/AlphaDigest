import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "*/10 14-22 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  try {
    const result = await refreshDashboardSnapshot("markets:latest");
    return json({ job: "refresh-markets", ...result, generatedAt: new Date().toISOString() }, result.ok ? 200 : 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown markets refresh error";
    console.error("dashboard_snapshot_refresh_error", { key: "markets:latest", error: message });
    return json({ ok: false, job: "refresh-markets", error: message }, 500);
  }
}
