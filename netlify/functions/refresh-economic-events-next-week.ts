import {
  economicRefreshDateKeysForPeriod,
  refreshInvestingEconomicEvents
} from "../../lib/data/adapters/investing-economic-calendar";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

// Staggered from the current-week job; this makes exactly one provider request daily.
export const config = { schedule: "40 1 * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const dateKeys = economicRefreshDateKeysForPeriod("next");
  const runId = await startJobRun({
    jobName: "Next Week Economic Events",
    functionName: "refresh-economic-events-next-week",
    source: "Investing.com"
  });
  try {
    const result = await refreshInvestingEconomicEvents(dateKeys);
    const snapshot =
      result.ok && result.persisted ? await refreshDashboardSnapshot("news-calendar:latest") : null;
    const ok = result.ok && result.persisted && Boolean(snapshot?.ok);
    await finishJobRun(runId, {
      status: ok ? "success" : "error",
      rowsFetched: result.count,
      rowsInserted: result.upserted ?? null,
      rowsDeleted: result.pruned ?? null,
      errorMessage: ok
        ? null
        : (result.error ?? snapshot?.error ?? "Next-week economic refresh failed."),
      metadata: { period: "next", dates: dateKeys, persisted: result.persisted }
    });
    return json(
      { job: "refresh-economic-events-next-week", startedAt, ...result, ok },
      ok ? 200 : 502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown next-week refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json(
      { ok: false, job: "refresh-economic-events-next-week", startedAt, error: message },
      500
    );
  }
}
