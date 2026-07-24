import { runEquityCandleRefresh } from "../../lib/data/equity-candle-ingestion";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";
import { parseBackfillControls } from "./backfill-equity-candles";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const authorized = (req: Request) =>
  !!process.env.DAILY_CANDLE_WORKER_TOKEN &&
  req.headers.get("x-alphadigest-worker-token") === process.env.DAILY_CANDLE_WORKER_TOKEN;
const MAX_CHAIN_DEPTH = 120;
export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  if (!authorized(req)) return json({ ok: false, error: "Unauthorized" }, 401);
  try {
    const raw = await req.json(),
      controls = parseBackfillControls(raw),
      correlationId =
        typeof raw.correlationId === "string" ? raw.correlationId : crypto.randomUUID(),
      chainDepth = Number.isInteger(raw.chainDepth) ? raw.chainDepth : 0;
    const run = await startJobRun({
      jobName: "Equity Candle Backfill",
      functionName: "backfill-equity-candles-worker-background",
      source: "Unusual Whales public candles",
      metadata: { correlationId, executionMode: "background", mode: "backfill", chainDepth } as any
    });
    try {
      console.info("backfill_worker_started", { correlationId, chainDepth });
      const result = await runEquityCandleRefresh({
        mode: "backfill",
        table: controls.table,
        symbols: controls.symbols,
        limitSymbols: controls.limitSymbols,
        from: controls.from,
        to: controls.to,
        resetFailed: controls.resetFailed,
        dryRun: controls.dryRun
      });
      const status = result.failedSymbols ? "warning" : "success";
      await finishJobRun(run, {
        status,
        rowsFetched: result.historicalRowsFetched,
        rowsInserted: result.rowsUpserted,
        warningMessage:
          status === "warning" ? "Backfill worker completed with failed symbols" : null,
        metadata: { correlationId, ...result } as any
      });
      let continuationDispatched = false;
      if (
        controls.continue &&
        result.symbolsRemaining > 0 &&
        result.failedSymbols === 0 &&
        chainDepth < MAX_CHAIN_DEPTH &&
        !controls.dryRun
      ) {
        const base = process.env.URL || process.env.DEPLOY_URL;
        if (base) {
          const response = await fetch(
            new URL("/.netlify/functions/backfill-equity-candles-worker-background", base),
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-alphadigest-worker-token": process.env.DAILY_CANDLE_WORKER_TOKEN!
              },
              body: JSON.stringify({ ...controls, correlationId, chainDepth: chainDepth + 1 })
            }
          );
          continuationDispatched = response.ok;
          console.info("backfill_continuation_dispatched", {
            correlationId,
            chainDepth,
            responseStatus: response.status
          });
        }
      }
      console.info("backfill_worker_completed", {
        correlationId,
        status,
        ...result,
        continuationDispatched
      });
      return json({
        ok: status === "success",
        correlationId,
        status,
        result,
        continuationDispatched
      });
    } catch (error) {
      const message = (error as Error).message;
      console.error("backfill_worker_failed", { correlationId, error: message });
      await finishJobRun(run, {
        status: "error",
        errorMessage: message,
        metadata: { correlationId, chainDepth } as any
      });
      return json({ ok: false, correlationId, status: "error", error: message }, 500);
    }
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 400);
  }
}
