import { refreshDarkPoolFlows } from "../../lib/data/adapters/unusual-whales-dark-pool";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "0 * * * 1-5" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const force = new URL(request.url).searchParams.get("force") === "true";
  const runWindow = shouldRunInTorontoWindow({ days: [1, 2, 3, 4, 5], startTime: "04:00", endTime: "20:00", intervalMinutes: 120, minuteOffset: 0 });
  if (!force && !runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-dark-pool", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "Dark Pool", functionName: "refresh-dark-pool", source: "Unusual Whales", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-dark-pool", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-dark-pool", startedAt, schedule: "Every 2 hours Mon-Fri 4 AM-8 PM America/Toronto", torontoTime: runWindow.torontoTime });
  const runId = await startJobRun({ jobName: "Dark Pool", functionName: "refresh-dark-pool", source: "Unusual Whales" });
  try {
    const result = await refreshDarkPoolFlows();
    console.log("scheduled_refresh_complete", { job: "refresh-dark-pool", ...result });
    await finishJobRun(runId, { status: result.ok && (result.count ?? 0) > 0 ? "success" : result.ok ? "warning" : "error", rowsFetched: result.count ?? null, rowsInserted: result.upserted ?? null, errorMessage: result.ok ? null : result.error, warningMessage: result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null, metadata: result.meta ?? {} });
    return json({ job: "refresh-dark-pool", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh-dark-pool refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-dark-pool", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-dark-pool", startedAt, error: message }, 500);
  }
}
