import {
  isExpectedCboeFetchWindow,
  refreshCboePutCallRatio
} from "../../lib/data/adapters/cboe-put-call";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "0,30 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  if (!force && !isExpectedCboeFetchWindow()) {
    await recordJobRun({ jobName: "Put/Call Ratio", functionName: "refresh-put-call", source: "Cboe", status: "skipped", startedAt, metadata: { reason: "outside_cboe_fetch_window" } });
    return json({
      ok: true,
      skipped: true,
      reason: "Outside expected Cboe 30-minute source release fetch windows: on the hour and half-hour from 9:00 AM through 3:30 PM America/Chicago / 10:00 AM through 4:30 PM ET."
    });
  }
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
