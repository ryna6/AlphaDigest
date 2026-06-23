import { refreshYahooMarketQuotes } from "../../lib/data/adapters/yahoo-finance";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";

export const config = { schedule: "*/5 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runWindow = shouldRunInTorontoWindow({
    days: [0, 1, 2, 3, 4, 5],
    intervalMinutes: 5,
    minuteOffset: 0
  });
  if (!runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-market-quotes", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "Market Overview", functionName: "refresh-market-quotes", source: "Finnhub", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-market-quotes", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-market-quotes", source: "Finnhub", startedAt, torontoTime: runWindow.torontoTime });
  const runId = await startJobRun({ jobName: "Market Overview", functionName: "refresh-market-quotes", source: "Finnhub" });
  try {
    const result = await refreshYahooMarketQuotes();
    console.log("scheduled_refresh_complete", { job: "refresh-market-quotes", rowsFetched: result.count, rowsUpserted: result.upserted ?? 0, persisted: result.persisted, ok: result.ok, error: result.error });
    await finishJobRun(runId, { status: result.ok && (result.count ?? 0) > 0 ? "success" : result.ok ? "warning" : "error", rowsFetched: result.count ?? null, rowsInserted: result.upserted ?? null, errorMessage: result.ok ? null : result.error, warningMessage: result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null, metadata: { persisted: result.persisted } });
    return json({ job: "refresh-market-quotes", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown market quotes refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-market-quotes", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-market-quotes", startedAt, error: message }, 500);
  }
}
