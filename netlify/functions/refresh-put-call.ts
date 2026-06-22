import { refreshCboePutCallRatio } from "../../lib/data/adapters/cboe-put-call";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "*/30 * * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun({ jobName: "Put/Call Ratio", functionName: "refresh-put-call", source: "Cboe" });
  try {
    const result = await refreshCboePutCallRatio();
    await finishJobRun(runId, { status: result.ok && result.response ? "success" : "error", rowsFetched: result.response ? 1 : 0, rowsInserted: result.upserted ?? null, errorMessage: result.ok ? null : result.error ?? "Cboe put/call refresh failed.", metadata: { persisted: result.persisted ?? false } });
    return json(result, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown put/call refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, error: message }, 500);
  }
}
