import { refreshTrackedInstitutionalPortfolios } from "../../lib/data/adapters/unusual-whales-institutional";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "0 10 * * *" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun({
    jobName: "Institutional Portfolios",
    functionName: "refresh-institutional-portfolios",
    source: "Unusual Whales"
  });
  try {
    const result = await refreshTrackedInstitutionalPortfolios();
    await finishJobRun(runId, {
      status: result.ok && (result.count ?? 0) > 0 ? "success" : result.ok ? "warning" : "error",
      rowsFetched: result.count ?? null,
      rowsInserted: result.upserted ?? null,
      errorMessage: result.ok ? null : result.error,
      warningMessage:
        result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null,
      metadata: result.meta ?? {}
    });
    return json(
      {
        job: "refresh-institutional-portfolios",
        startedAt,
        finishedAt: new Date().toISOString(),
        ...result
      },
      result.ok ? 200 : 502
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown institutional portfolios refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json(
      { ok: false, job: "refresh-institutional-portfolios", startedAt, error: message },
      500
    );
  }
}
