import { refreshYahooMarketQuotes } from "../../lib/data/adapters/yahoo-finance";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { refreshSp500Heatmap } from "../../lib/data/adapters/unusual-whales-sp500-heatmap";
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
    console.info("scheduled_refresh_skipped", { job: "refresh-markets", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "Indices/Heatmaps", functionName: "refresh-markets", source: "Yahoo Finance, Finnhub, Unusual Whales", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-markets", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-markets", startedAt, sources: ["yahoo_market_quotes"], snapshotKey: "markets:latest", torontoTime: runWindow.torontoTime });
  const runId = await startJobRun({ jobName: "Indices/Heatmaps", functionName: "refresh-markets", source: "Yahoo Finance, Finnhub, Unusual Whales" });
  try {
    const [marketQuotes, sp500Heatmap] = await Promise.all([refreshYahooMarketQuotes(), refreshSp500Heatmap()]);
    const snapshot = await refreshDashboardSnapshot("markets:latest");
    const ok = marketQuotes.ok && sp500Heatmap.ok && snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-markets", quoteRows: marketQuotes.count, quoteUpserted: marketQuotes.upserted ?? 0, sp500Rows: sp500Heatmap.count, sp500Upserted: sp500Heatmap.upserted ?? 0, snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok });
    await finishJobRun(runId, { status: ok && (marketQuotes.count ?? 0) > 0 ? "success" : ok ? "warning" : "error", rowsFetched: (marketQuotes.count ?? 0) + (sp500Heatmap.count ?? 0), rowsInserted: (marketQuotes.upserted ?? 0) + (sp500Heatmap.upserted ?? 0), errorMessage: ok ? null : marketQuotes.error ?? sp500Heatmap.error ?? snapshot.error ?? "Markets refresh failed.", warningMessage: ok && ((marketQuotes.count ?? 0) + (sp500Heatmap.count ?? 0)) === 0 ? "Job completed with zero fetched rows." : null, metadata: { snapshotPersisted: snapshot.persisted, snapshotKey: snapshot.key, sp500Heatmap: sp500Heatmap.meta } });
    return json({ job: "refresh-markets", startedAt, finishedAt: new Date().toISOString(), ok, marketQuotes, sp500Heatmap, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown markets refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-markets", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-markets", startedAt, error: message }, 500);
  }
}
