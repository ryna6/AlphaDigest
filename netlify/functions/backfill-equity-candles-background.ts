import { runEquityCandleRefresh } from "../../lib/data/equity-candle-ingestion";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const authorized = (req: Request) =>
  !!process.env.DAILY_CANDLE_WORKER_TOKEN &&
  req.headers.get("x-alphadigest-worker-token") === process.env.DAILY_CANDLE_WORKER_TOKEN;

export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  if (!authorized(req)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const correlationId = String(body.correlationId ?? crypto.randomUUID());
  const run = await startJobRun({
    jobName: "Equity Candle Backfill",
    functionName: "backfill-equity-candles-background",
    source: "Unusual Whales public candles",
    metadata: { correlationId, executionMode: "background", mode: "backfill" } as any
  });
  try {
    console.info("daily_candle_worker_started", { correlationId, mode: "backfill" });
    const result = await runEquityCandleRefresh({
      mode: "backfill",
      table: body.table,
      symbol: body.symbol,
      limitSymbols: body.limit,
      from: body.from,
      to: body.to,
      resetFailed: body.resetFailed === true
    });
    const status = result.failedSymbols ? "warning" : "success";
    await finishJobRun(run, {
      status,
      rowsFetched: result.historicalRowsFetched,
      rowsInserted: result.rowsUpserted,
      warningMessage: status === "warning" ? "Backfill completed with failed symbols" : null,
      metadata: { correlationId, ...result } as any
    });
    console.info("daily_candle_worker_completed", { correlationId, status, ...result });
    return json({ ok: status === "success", correlationId, status, result });
  } catch (error) {
    const message = (error as Error).message;
    console.error("daily_candle_worker_failed", { correlationId, error: message });
    await finishJobRun(run, {
      status: "error",
      errorMessage: message,
      metadata: { correlationId, executionMode: "background", mode: "backfill" } as any
    });
    return json({ ok: false, correlationId, status: "error", error: message }, 500);
  }
}
