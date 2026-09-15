import { refreshInsiderTrades } from "../../lib/data/adapters/unusual-whales-insider-trades";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "3 * * * *" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const force = new URL(request.url).searchParams.get("force") === "true";
  const runWindow = shouldRunInTorontoWindow({ days: [1, 2, 3, 4, 5] });
  if (!force && !runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-insider-trades", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "Insider Trades", functionName: "refresh-insider-trades", source: "Unusual Whales", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-insider-trades", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-insider-trades", startedAt, schedule: "Every hour Mon-Fri", torontoTime: runWindow.torontoTime });
  const runId = await startJobRun({ jobName: "Insider Trades", functionName: "refresh-insider-trades", source: "Unusual Whales" });
  try {
    const result = await refreshInsiderTrades();
    console.log("scheduled_refresh_complete", { job: "refresh-insider-trades", ...result });
    await finishJobRun(runId, { status: result.ok && (result.count ?? 0) > 0 ? "success" : result.ok ? "warning" : "error", rowsFetched: result.count ?? null, rowsInserted: result.upserted ?? null, errorMessage: result.ok ? null : result.error, warningMessage: result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null, metadata: result.meta ?? {} });
    return json({ job: "refresh-insider-trades", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh-insider-trades refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-insider-trades", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-insider-trades", startedAt, error: message }, 500);
  }
}
