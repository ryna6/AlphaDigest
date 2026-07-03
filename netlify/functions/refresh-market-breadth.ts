import { refreshMarketBreadth } from "../../lib/data/adapters/market-breadth";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "*/15 * * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const SOURCE = "Investing.com, Yahoo Finance";

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.info("refresh-market-breadth", {
    stage: "request_started",
    startedAt,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
  const runWindow = shouldRunInTorontoWindow({
    days: [1, 2, 3, 4, 5],
    intervalMinutes: 15,
    minuteOffset: 0
  });
  if (!runWindow.shouldRun) {
    console.info("refresh-market-breadth", {
      stage: "schedule_rejected",
      reason: runWindow.reason,
      torontoTime: runWindow.torontoTime
    });
    await recordJobRun({
      jobName: "Market Breadth",
      functionName: "refresh-market-breadth",
      source: SOURCE,
      status: "skipped",
      startedAt,
      metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime }
    });
    return json({
      ok: true,
      skipped: true,
      job: "refresh-market-breadth",
      startedAt,
      reason: runWindow.reason,
      torontoTime: runWindow.torontoTime
    });
  }

  console.info("refresh-market-breadth", {
    stage: "schedule_allowed",
    torontoTime: runWindow.torontoTime
  });
  const runId = await startJobRun({
    jobName: "Market Breadth",
    functionName: "refresh-market-breadth",
    source: SOURCE
  });
  try {
    const breadth = await refreshMarketBreadth();
    const snapshot = breadth.ok
      ? await refreshDashboardSnapshot("markets:latest")
      : {
          ok: false,
          persisted: false,
          key: "markets:latest",
          error: "Skipped Markets snapshot refresh because Market Breadth provider parsing failed."
        };
    const ok = breadth.ok && snapshot.ok;
    await finishJobRun(runId, {
      status: ok ? "success" : "error",
      rowsFetched: breadth.count ?? 0,
      rowsInserted: breadth.upserted ?? 0,
      errorMessage: ok
        ? null
        : (breadth.error ?? snapshot.error ?? "Market breadth refresh failed."),
      metadata: {
        breadth: breadth.meta,
        snapshotPersisted: snapshot.persisted,
        snapshotKey: snapshot.key
      }
    });
    console.info("refresh-market-breadth", {
      stage: "job_run_recorded",
      status: ok ? "success" : "error"
    });
    return json(
      {
        job: "refresh-market-breadth",
        startedAt,
        finishedAt: new Date().toISOString(),
        ok,
        breadth,
        snapshot
      },
      ok ? 200 : 502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Market Breadth refresh error";
    console.error("refresh-market-breadth", {
      stage: "failed",
      error: message,
      preservedCache: true
    });
    await finishJobRun(runId, {
      status: "error",
      errorMessage: message,
      metadata: { failedStage: "unhandled", preservedCache: true }
    });
    console.info("refresh-market-breadth", { stage: "job_run_recorded", status: "error" });
    return json({ ok: false, job: "refresh-market-breadth", startedAt, error: message }, 500);
  }
}
