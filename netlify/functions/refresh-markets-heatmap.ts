import { refreshBarchartSp500Breadth } from "../../lib/data/adapters/barchart-sp500-breadth";
import { refreshSp500Heatmap } from "../../lib/data/adapters/unusual-whales-sp500-heatmap";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "*/10 * * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runWindow = shouldRunInTorontoWindow({ days: [1, 2, 3, 4, 5], intervalMinutes: 10, minuteOffset: 0 });
  if (!runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-markets-heatmap", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "S&P 500 Heatmap", functionName: "refresh-markets-heatmap", source: "Unusual Whales", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-markets-heatmap", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }

  console.log("scheduled_refresh_start", { job: "refresh-markets-heatmap", startedAt, source: "unusual_whales_sp500_heatmap", torontoTime: runWindow.torontoTime });
  const runId = await startJobRun({ jobName: "S&P 500 Heatmap", functionName: "refresh-markets-heatmap", source: "Unusual Whales" });
  try {
    const [sp500Heatmap, sp500Breadth] = await Promise.all([refreshSp500Heatmap(), refreshBarchartSp500Breadth()]);
    const snapshot = await refreshDashboardSnapshot("markets:latest");
    const ok = sp500Heatmap.ok && sp500Breadth.ok && snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-markets-heatmap", sp500Rows: sp500Heatmap.count, sp500Upserted: sp500Heatmap.upserted ?? 0, breadthRows: sp500Breadth.count, breadthUpserted: sp500Breadth.upserted ?? 0, snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok });
    await finishJobRun(runId, { status: ok && (sp500Heatmap.count ?? 0) > 0 && (sp500Breadth.count ?? 0) > 0 ? "success" : ok ? "warning" : "error", rowsFetched: (sp500Heatmap.count ?? 0) + (sp500Breadth.count ?? 0), rowsInserted: (sp500Heatmap.upserted ?? 0) + (sp500Breadth.upserted ?? 0), errorMessage: ok ? null : sp500Heatmap.error ?? sp500Breadth.error ?? snapshot.error ?? "S&P 500 markets refresh failed.", warningMessage: ok && ((sp500Heatmap.count ?? 0) === 0 || (sp500Breadth.count ?? 0) === 0) ? "Job completed with zero fetched rows for one or more S&P 500 sources." : null, metadata: { snapshotPersisted: snapshot.persisted, snapshotKey: snapshot.key, sp500Heatmap: sp500Heatmap.meta, sp500Breadth: sp500Breadth.meta } });
    return json({ job: "refresh-markets-heatmap", startedAt, finishedAt: new Date().toISOString(), ok, sp500Heatmap, sp500Breadth, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown S&P 500 heatmap refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-markets-heatmap", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-markets-heatmap", startedAt, error: message }, 500);
  }
}
