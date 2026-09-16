import { refreshInstitutionalSummaryData } from "../../lib/data/adapters/unusual-whales-institutional";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "0 10 * * *" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun({
    jobName: "Institutional Summary",
    functionName: "refresh-institutional-summary",
    source: "Unusual Whales"
  });
  try {
    const result = await refreshInstitutionalSummaryData();
    const snapshot = result.ok ? await refreshDashboardSnapshot("ownership:latest") : null;
    const ok = result.ok && snapshot?.ok === true;
    await finishJobRun(runId, {
      status: ok && (result.count ?? 0) > 0 ? "success" : ok ? "warning" : "error",
      rowsFetched: result.count ?? null,
      rowsInserted: result.upserted ?? null,
      errorMessage: ok
        ? null
        : (result.error ?? snapshot?.error ?? "Ownership snapshot refresh failed."),
      warningMessage:
        result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null,
      metadata: { ...(result.meta ?? {}), snapshotPersisted: snapshot?.persisted ?? false }
    });
    return json(
      {
        job: "refresh-institutional-summary",
        startedAt,
        finishedAt: new Date().toISOString(),
        ...result,
        ok,
        snapshot
      },
      ok ? 200 : 502
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown institutional summary refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json(
      { ok: false, job: "refresh-institutional-summary", startedAt, error: message },
      500
    );
  }
}
