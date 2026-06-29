import { refreshEconomyObservations } from "../../lib/data/adapters/economy-observations";
import { getEconomyPayload } from "../../lib/data/economy";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "0 */6 * * *" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-economy", source: "FRED", startedAt });
  const runId = await startJobRun({ jobName: "Economy Data", functionName: "refresh-economy", source: "FRED" });
  try {
    const result = await refreshEconomyObservations();
    const snapshot = result.ok ? await getEconomyPayload() : null;
    const ok = result.ok && Boolean(snapshot);
    console.log("scheduled_refresh_complete", { job: "refresh-economy", ok, rowsFetched: result.count, rowsUpserted: result.upserted, seriesFetched: result.seriesFetched, seriesFailed: result.seriesFailed });
    await finishJobRun(runId, {
      status: ok && result.seriesFailed.length ? "warning" : ok ? "success" : "error",
      rowsFetched: result.count,
      rowsInserted: result.upserted,
      errorMessage: ok ? null : result.error ?? "Economy refresh failed.",
      warningMessage: ok && result.seriesFailed.length ? `Some FRED series failed: ${result.seriesFailed.join(", ")}` : null,
      metadata: { provider: "FRED", seriesFetched: result.seriesFetched, seriesFailed: result.seriesFailed, snapshotMode: snapshot?.mode ?? null }
    });
    return json({ job: "refresh-economy", startedAt, finishedAt: new Date().toISOString(), ...result, snapshotMode: snapshot?.mode ?? null }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown economy refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-economy", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-economy", startedAt, error: message }, 500);
  }
}
