import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { refreshDarkPoolFlows } from "../../lib/data/adapters/unusual-whales-dark-pool";
import { refreshInsiderTrades } from "../../lib/data/adapters/unusual-whales-insider-trades";
import { refreshWhaleFeed } from "../../lib/data/adapters/unusual-whales-whale-feed";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";
import { finishJobRun, recordJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "5 * * * *" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runWindow = shouldRunInTorontoWindow({ intervalMinutes: 60, minuteOffset: 5 });
  if (!runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-flow", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    await recordJobRun({ jobName: "Flow Snapshot", functionName: "refresh-flow", source: "Supabase", status: "skipped", startedAt, metadata: { reason: runWindow.reason, torontoTime: runWindow.torontoTime } });
    return json({ ok: true, skipped: true, job: "refresh-flow", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-flow", startedAt, schedule: "Every hour daily at :05", torontoTime: runWindow.torontoTime });
  const runId = await startJobRun({ jobName: "Flow Snapshot", functionName: "refresh-flow", source: "Supabase" });
  try {
  const [darkPool, insiderTrades, whaleFeed] = await Promise.all([refreshDarkPoolFlows(), refreshInsiderTrades(), refreshWhaleFeed()]);
  const sourceStatuses = {
    darkPool: { ok: darkPool.ok, count: darkPool.count, upserted: darkPool.upserted, error: darkPool.error, meta: darkPool.meta },
    whaleFeed: { ok: whaleFeed.ok, count: whaleFeed.count, upserted: whaleFeed.upserted, sourceRowCount: whaleFeed.count, error: whaleFeed.error, meta: whaleFeed.meta },
    insiderTrades: { ok: insiderTrades.ok, count: insiderTrades.count, upserted: insiderTrades.upserted, error: insiderTrades.error, meta: insiderTrades.meta }
  };
  const freshSourceCount = [darkPool, insiderTrades, whaleFeed].filter((source) => source.ok).length;
  const partialSnapshot = freshSourceCount > 0 && freshSourceCount < 3;
  const snapshot = freshSourceCount > 0 ? await refreshDashboardSnapshot("flow:latest") : { ok: false, key: "flow:latest", persisted: false, error: "No Flow sources refreshed successfully; snapshot not persisted." };
  const sectionsIncluded = Object.entries(sourceStatuses).filter(([, status]) => status.ok).map(([section]) => section);
  const sectionsMissing = Object.entries(sourceStatuses).filter(([, status]) => !status.ok).map(([section]) => section);
  const ok = snapshot.ok && freshSourceCount > 0;
  const snapshotFreshness = snapshot.ok && snapshot.persisted ? (partialSnapshot ? "partial_fresh_sources" : "all_sources_fresh") : "not_persisted";
  const notices = [
    ...(partialSnapshot ? ["Flow snapshot contains partial fresh data because one source refresh failed or returned unusable data."] : []),
    ...(!freshSourceCount ? ["No Flow sources refreshed successfully; flow:latest was not rewritten."] : [])
  ];
  console.log("scheduled_refresh_complete", { job: "refresh-flow", sourceStatuses, snapshotPersisted: snapshot.persisted, partialSnapshot, sectionsIncluded, sectionsMissing, snapshotFreshness, notices, ok });
  await finishJobRun(runId, { status: ok && partialSnapshot ? "warning" : ok ? "success" : "error", rowsFetched: darkPool.count + insiderTrades.count + whaleFeed.count, rowsInserted: (darkPool.upserted ?? 0) + (insiderTrades.upserted ?? 0) + (whaleFeed.upserted ?? 0), errorMessage: ok ? null : snapshot.error ?? "Flow snapshot refresh failed.", warningMessage: partialSnapshot ? "Flow snapshot contains partial fresh data." : null, metadata: { sourceStatuses, snapshotPersisted: snapshot.persisted, sectionsIncluded, sectionsMissing, snapshotFreshness, notices } });
  return json({ job: "refresh-flow", startedAt, finishedAt: new Date().toISOString(), ok, partialSnapshot, sourceStatuses, darkPool, insiderTrades, whaleFeed, snapshot, snapshotPersisted: snapshot.persisted, sectionsIncluded, sectionsMissing, snapshotFreshness, notices }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown flow refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-flow", error: message });
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-flow", startedAt, error: message }, 500);
  }
}
