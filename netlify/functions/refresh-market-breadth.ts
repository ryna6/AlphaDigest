import { refreshBarchartSp500Breadth } from "../../lib/data/adapters/barchart-sp500-breadth";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "*/15 * * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runWindow = shouldRunInTorontoWindow({ days: [1, 2, 3, 4, 5], intervalMinutes: 15, minuteOffset: 0 });
  if (!runWindow.shouldRun) {
    await recordJobRun({ jobName: "Market Breadth", functionName: "refresh-market-breadth", source: "Barchart", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-market-breadth", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }

  const runId = await startJobRun({ jobName: "Market Breadth", functionName: "refresh-market-breadth", source: "Barchart" });
  try {
    const breadth = await refreshBarchartSp500Breadth();
    const snapshot = breadth.ok ? await refreshDashboardSnapshot("markets:latest") : { ok: false, persisted: false, key: "markets:latest", error: "Skipped Markets snapshot refresh because Barchart breadth parsing failed." };
    const ok = breadth.ok && snapshot.ok;
    await finishJobRun(runId, { status: ok ? "success" : "error", rowsFetched: breadth.count ?? 0, rowsInserted: breadth.upserted ?? 0, errorMessage: ok ? null : breadth.error ?? snapshot.error ?? "Market breadth refresh failed.", metadata: { breadth: breadth.meta, snapshotPersisted: snapshot.persisted, snapshotKey: snapshot.key } });
    return json({ job: "refresh-market-breadth", startedAt, finishedAt: new Date().toISOString(), ok, breadth, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Market Breadth refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-market-breadth", startedAt, error: message }, 500);
  }
}
