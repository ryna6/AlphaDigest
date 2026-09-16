import {
  economicRefreshDateKeysFromParams,
  refreshInvestingEconomicEvents
} from "../../lib/data/adapters/investing-economic-calendar";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "10 */6 * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dateKeys = economicRefreshDateKeysFromParams(new URL(request.url).searchParams);
  console.log("scheduled_refresh_start", {
    job: "refresh-economic-events",
    source: "investing_economic_events",
    startedAt,
    dateKeys
  });
  const runId = await startJobRun({
    jobName: "Today’s Economic Events",
    functionName: "refresh-economic-events",
    source: "Investing.com"
  });
  try {
    const result = await refreshInvestingEconomicEvents(dateKeys);
    const snapshots =
      result.ok && result.persisted
        ? await Promise.all([
            refreshDashboardSnapshot("today:latest"),
            refreshDashboardSnapshot("news-calendar:latest")
          ])
        : [];
    const snapshotsOk = snapshots.every((snapshot) => snapshot.ok);
    const ok = result.ok && result.persisted && snapshotsOk;
    console.log("scheduled_refresh_complete", {
      job: "refresh-economic-events",
      rowsFetched: result.count,
      rowsUpserted: result.upserted ?? 0,
      persisted: result.persisted,
      ok: result.ok,
      error: result.error
    });
    await finishJobRun(runId, {
      status: ok && (result.count ?? 0) > 0 ? "success" : "error",
      rowsFetched: result.count ?? null,
      rowsInserted: result.upserted ?? null,
      errorMessage: ok
        ? null
        : (result.error ??
          snapshots.find((snapshot) => !snapshot.ok)?.error ??
          "Economic calendar snapshot refresh failed."),
      warningMessage: null,
      metadata: {
        persisted: result.persisted,
        snapshots: snapshots.map((snapshot) => ({
          key: snapshot.key,
          persisted: snapshot.persisted,
          revalidation: snapshot.revalidation
        }))
      }
    });
    return json(
      {
        job: "refresh-economic-events",
        startedAt,
        finishedAt: new Date().toISOString(),
        ...result,
        ok,
        snapshots
      },
      ok ? 200 : 502
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown economic events refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-economic-events", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-economic-events", startedAt, error: message }, 500);
  }
}
