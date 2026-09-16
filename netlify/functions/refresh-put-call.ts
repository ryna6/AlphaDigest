import { refreshCboePutCallRatio } from "../../lib/data/adapters/cboe-put-call";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "*/30 * * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun({
    jobName: "Put/Call Ratio",
    functionName: "refresh-put-call",
    source: "Cboe"
  });
  try {
    const result = await refreshCboePutCallRatio();
    const snapshot =
      result.ok && result.persisted ? await refreshDashboardSnapshot("sentiment:latest") : null;
    const ok = result.ok && result.response && snapshot?.ok === true;
    await finishJobRun(runId, {
      status: ok ? "success" : "error",
      rowsFetched: result.response ? 1 : 0,
      rowsInserted: result.upserted ?? null,
      errorMessage: ok
        ? null
        : (result.error ?? snapshot?.error ?? "Sentiment snapshot refresh failed."),
      metadata: {
        persisted: result.persisted ?? false,
        snapshotPersisted: snapshot?.persisted ?? false
      }
    });
    return json({ ...result, ok, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown put/call refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, error: message }, 500);
  }
}
