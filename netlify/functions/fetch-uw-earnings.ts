import {
  defaultEarningsRange,
  refreshUnusualWhalesEarnings
} from "../../lib/data/adapters/unusual-whales-earnings";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "0,30 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function dateParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function handler(request: Request) {
  const defaults = defaultEarningsRange();
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const runWindow = shouldRunInTorontoWindow({ startTime: "14:00", endTime: "18:00", intervalMinutes: 30, minuteOffset: 0 });
  if (!force && !runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "fetch-uw-earnings", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "Today’s Earnings", functionName: "fetch-uw-earnings", source: "Unusual Whales", status: "skipped", startedAt: new Date().toISOString(), metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "fetch-uw-earnings", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  const range = {
    minDate: dateParam(url, "min_date") ?? defaults.minDate,
    maxDate: dateParam(url, "max_date") ?? defaults.maxDate
  };
  const runId = await startJobRun({ jobName: "Today’s Earnings", functionName: "fetch-uw-earnings", source: "Unusual Whales", metadata: { range } });
  try {
    const result = await refreshUnusualWhalesEarnings(range);
    console.log("uw_earnings_refresh", {
      source: "unusual_whales_earnings",
      min_date: range.minDate,
      max_date: range.maxDate,
      row_count: result.rowCount,
      changed: result.changed,
      persisted: result.persisted
    });
    await finishJobRun(runId, { status: result.ok && result.rowCount > 0 ? "success" : result.ok ? "warning" : "error", rowsFetched: result.rowCount, rowsInserted: result.changedRows ?? null, warningMessage: result.ok && result.rowCount === 0 ? "Job completed with zero fetched rows." : null, metadata: { persisted: result.persisted, changed: result.changed, range } });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown earnings refresh error";
    console.error("uw_earnings_refresh_error", {
      min_date: range.minDate,
      max_date: range.maxDate,
      error: message
    });
    await finishJobRun(runId, { status: "error", errorMessage: message, metadata: { range } });
    return json({ ok: false, range, error: message }, 500);
  }
}
