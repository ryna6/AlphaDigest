import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "*/30 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  try {
    const result = await refreshDashboardSnapshot("news-calendar:latest");
    return json({ job: "refresh-news", ...result, generatedAt: new Date().toISOString() }, result.ok ? 200 : 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news/calendar refresh error";
    console.error("dashboard_snapshot_refresh_error", { key: "news-calendar:latest", error: message });
    return json({ ok: false, job: "refresh-news", error: message }, 500);
  }
}
