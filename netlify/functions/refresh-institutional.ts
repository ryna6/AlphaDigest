import { refreshInstitutionalData } from "../../lib/data/adapters/unusual-whales-institutional";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "0 8 * * *" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runId = await startJobRun({ jobName: "Institutional", functionName: "refresh-institutional", source: "Unusual Whales" });
  try {
    const result = await refreshInstitutionalData();
    await finishJobRun(runId, { status: result.ok && (result.count ?? 0) > 0 ? "success" : result.ok ? "warning" : "error", rowsFetched: result.count ?? null, rowsInserted: result.upserted ?? null, errorMessage: result.ok ? null : result.error, warningMessage: result.ok && (result.count ?? 0) === 0 ? "Job completed with zero fetched rows." : null, metadata: result.meta ?? {} });
    return json({ job: "refresh-institutional", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown institutional refresh error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return json({ ok: false, job: "refresh-institutional", startedAt, error: message }, 500);
  }
}
