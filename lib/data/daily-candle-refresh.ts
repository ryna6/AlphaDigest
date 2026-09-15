import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, getSupabaseProjectHost } from "@/lib/db/supabase";
import { getDailyCandleFinnhubKeys } from "./adapters/finnhub-key-router";
import {
  getSp500CandleUniverse,
  normalizeFinnhubQuote,
  pruneDailyCandles,
  readCandlesForApi,
  upsertDailyCandles,
  oneYearCutoff,
  type CandleTable
} from "./daily-candles";
import { cryptoCandleAssets, marketCandleAssets } from "./market-assets";
import { runEquityCandleRefresh } from "./equity-candle-ingestion";
import { refreshDashboardSnapshot } from "./live-dashboard";
import {
  cryptoCandleEndpointAssets,
  fetchUnusualWhalesCryptoCandles,
  verifyCryptoCandleDatabaseReady
} from "./unusual-whales-crypto-candles";
import { refreshSp500FuturesCandles } from "./unusual-whales-futures-candles";

export type EquityCandleJob = {
  table: "market_daily_candles" | "sp500_daily_candles";
  symbol: string;
  providerSymbol: string;
  assetGroup?: string;
  group: "markets" | "sp500";
};
type GroupSummary = {
  configuredSymbols: number;
  attemptedSymbols: number;
  successfulSymbols: number;
  failedSymbols: number;
  rowsUpserted: number;
  rowsVerified: number;
  failures: Array<{ symbol: string; message: string; lane?: number }>;
};
const emptyGroup = (): GroupSummary => ({
  configuredSymbols: 0,
  attemptedSymbols: 0,
  successfulSymbols: 0,
  failedSymbols: 0,
  rowsUpserted: 0,
  rowsVerified: 0,
  failures: []
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (level: "info" | "warn" | "error", event: string, data: Record<string, unknown>) =>
  console[level](event, { ...data, at: new Date().toISOString() });

export function dailyCandleEnvironmentSummary() {
  const keys = getDailyCandleFinnhubKeys();
  return {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    distinctFinnhubKeyCount: keys.length,
    supabaseProjectHost: getSupabaseProjectHost(),
    deployContext: process.env.CONTEXT ?? null,
    deployId: process.env.DEPLOY_ID ?? null,
    siteUrl: process.env.URL ?? process.env.DEPLOY_URL ?? null
  };
}
function sanitizeSupabaseError(error: any, table: CandleTable) {
  return {
    table,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    details: error?.details ?? null,
    hint: error?.hint ?? null
  };
}
export async function verifyEquityCandleTablesReady(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return { ok: false as const, tables: {}, error: supabase.message };
  const tables = ["market_daily_candles", "sp500_daily_candles"] as const;
  const results: any = {};
  for (const table of tables) {
    const { error } = await supabase.client
      .from(table)
      .select(
        table === "sp500_daily_candles"
          ? "symbol,trading_date,open,high,low,close,volume,previous_close,fetched_at"
          : "symbol,provider_symbol,trading_date,open,high,low,close,volume,previous_close,source,fetched_at"
      )
      .limit(0);
    results[table] = error
      ? { ok: false, error: sanitizeSupabaseError(error, table) }
      : { ok: true };
  }
  return { ok: tables.every((t) => results[t].ok), tables: results, supabase: supabase.client };
}
export async function getDailyEquityCandleJobs(client?: SupabaseClient) {
  const rawRows = await import("./adapters/unusual-whales-sp500-heatmap").then((m) =>
    m.readCachedSp500HeatmapRows(client)
  );
  const normalized = rawRows.rows.map((r: any) =>
    String(r.ticker ?? "")
      .toUpperCase()
      .trim()
      .replace(/\./g, "-")
  );
  const invalid = normalized.filter((s) => !/^[A-Z][A-Z0-9-]*$/.test(s));
  const sp500Symbols = Array.from(
    new Set(normalized.filter((s) => /^[A-Z][A-Z0-9-]*$/.test(s)))
  ).sort();
  const marketJobs = marketCandleAssets
    .filter((a) => a.chartAvailable && a.finnhubSymbol)
    .map((a) => ({
      table: "market_daily_candles" as const,
      symbol: a.symbol,
      providerSymbol: a.finnhubSymbol!,
      assetGroup: a.group,
      group: "markets" as const
    }));
  const sp500Jobs = sp500Symbols.map((symbol) => ({
    table: "sp500_daily_candles" as const,
    symbol,
    providerSymbol: symbol.replace(/-/g, "."),
    group: "sp500" as const
  }));
  return {
    jobs: [...marketJobs, ...sp500Jobs],
    markets: marketJobs,
    sp500: sp500Jobs,
    universeDiagnostics: {
      rawHeatmapRows: rawRows.rows.length,
      uniqueNormalizedSymbols: sp500Symbols.length,
      firstFiveSymbols: sp500Symbols.slice(0, 5),
      lastFiveSymbols: sp500Symbols.slice(-5),
      duplicateCount: normalized.length - new Set(normalized).size,
      invalidSymbolCount: invalid.length
    }
  };
}
async function fetchFinnhubQuoteWithRetry(
  symbol: string,
  key: string,
  lane: number,
  maxRetries = 2
) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
      { cache: "no-store" }
    );
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(10000, 1000 * 2 ** attempt);
      log("warn", "daily_candle_symbol_retry", {
        provider: "Finnhub",
        lane,
        status: res.status,
        delayMs: delay
      });
      await sleep(delay);
      continue;
    }
    throw new Error(`Finnhub ${res.status}`);
  }
}
async function verifyOne(table: CandleTable, symbol: string, client?: SupabaseClient) {
  const rows = (await readCandlesForApi(table, symbol, "1W", client)) as any[];
  return rows.length;
}
async function processGroup(
  name: "markets" | "sp500",
  jobs: EquityCandleJob[],
  keys: ReturnType<typeof getDailyCandleFinnhubKeys>,
  client: SupabaseClient,
  correlationId: string
) {
  const summary = emptyGroup();
  summary.configuredSymbols = jobs.length;
  if (!jobs.length) return summary;
  const started = Date.now();
  log("info", "daily_candle_lane_started", {
    correlationId,
    group: name,
    table: jobs[0]?.table,
    configuredCount: jobs.length,
    lanes: keys.length
  });
  await Promise.all(
    keys.map(async (lane, laneIndex) => {
      for (let i = laneIndex; i < jobs.length; i += keys.length) {
        const job = jobs[i];
        await sleep(2000);
        summary.attemptedSymbols++;
        try {
          const q = await fetchFinnhubQuoteWithRetry(job.providerSymbol, lane.key, laneIndex + 1);
          const c = normalizeFinnhubQuote(job.symbol, job.providerSymbol, q);
          c.assetGroup = job.assetGroup;
          const up = await upsertDailyCandles(job.table, [c], client);
          const verified = await verifyOne(job.table, job.symbol, client);
          if (!verified) throw new Error("Post-upsert verification found zero rows");
          summary.rowsUpserted += up.upserted;
          summary.rowsVerified += verified;
          summary.successfulSymbols++;
        } catch (e) {
          summary.failedSymbols++;
          if (summary.failures.length < 20)
            summary.failures.push({
              symbol: job.symbol,
              lane: laneIndex + 1,
              message: (e as Error).message.slice(0, 240)
            });
          log("warn", "daily_candle_symbol_failed", {
            correlationId,
            group: name,
            table: job.table,
            symbol: job.symbol,
            lane: laneIndex + 1,
            error: (e as Error).message.slice(0, 240)
          });
        }
        if (summary.attemptedSymbols % 20 === 0)
          log("info", "daily_candle_progress", {
            correlationId,
            group: name,
            table: job.table,
            configuredCount: jobs.length,
            attemptedCount: summary.attemptedSymbols,
            successfulCount: summary.successfulSymbols,
            failedCount: summary.failedSymbols,
            rowsUpserted: summary.rowsUpserted,
            elapsedMs: Date.now() - started,
            estimatedRemainingJobs: jobs.length - summary.attemptedSymbols
          });
      }
    })
  );
  log("info", "daily_candle_table_completed", {
    correlationId,
    group: name,
    configuredCount: jobs.length,
    ...summary,
    elapsedMs: Date.now() - started
  });
  return summary;
}
export async function refreshDailyMarketCandles(
  options: { correlationId?: string; manual?: boolean; client?: SupabaseClient } = {}
) {
  const correlationId = options.correlationId ?? crypto.randomUUID();
  const started = Date.now();
  log("info", "daily_candle_worker_started", {
    correlationId,
    mode: "daily",
    provider: "Unusual Whales Equity, Unusual Whales Futures",
    manual: !!options.manual
  });
  const env = dailyCandleEnvironmentSummary();
  log("info", "daily_candle_environment_checked", { correlationId, ...env });
  const db = await verifyEquityCandleTablesReady(options.client);
  log(db.ok ? "info" : "error", "daily_candle_database_checked", {
    correlationId,
    ok: db.ok,
    tables: db.tables
  });
  if (!db.ok)
    throw new Error(
      `Equity candle database not ready: ${JSON.stringify((db as any).tables ?? (db as any).error)}`
    );

  log("info", "daily_candle_futures_started", { correlationId });
  const futuresSummary = await refreshSp500FuturesCandles(db.supabase);
  log(futuresSummary.failure ? "warn" : "info", "daily_candle_futures_completed", {
    correlationId,
    provider: "Unusual Whales Futures EOD",
    table: "market_daily_candles",
    ...futuresSummary
  });

  log("info", "daily_candle_equity_started", { correlationId });
  const equitySummary = await runEquityCandleRefresh({ mode: "daily", client: db.supabase });
  log("info", "daily_candle_equity_completed", { correlationId, ...equitySummary });

  log("info", "daily_candle_snapshot_started", { correlationId });
  const snapshot = await refreshDashboardSnapshot("markets:latest");
  log("info", "daily_candle_snapshot_completed", { correlationId });
  const failedSymbols = equitySummary.failedSymbols + futuresSummary.failedSymbols;
  const rowsUpserted = equitySummary.rowsUpserted + futuresSummary.rowsUpserted;
  const equityAllFailed =
    equitySummary.attemptedSymbols > 0 && equitySummary.successfulSymbols === 0;
  const status =
    rowsUpserted === 0 || equityAllFailed ? "error" : failedSymbols ? "warning" : "success";
  const result = {
    correlationId,
    status,
    executionMode: "background",
    provider: "Unusual Whales Equity, Unusual Whales Futures",
    ...equitySummary,
    configuredSymbols: equitySummary.configuredSymbols + futuresSummary.configuredSymbols,
    attemptedSymbols: equitySummary.attemptedSymbols + futuresSummary.attemptedSymbols,
    successfulSymbols: equitySummary.successfulSymbols + futuresSummary.successfulSymbols,
    failedSymbols,
    rowsUpserted,
    rowsVerified: equitySummary.rowsVerified + futuresSummary.rowsVerified,
    rowsPruned: 0,
    pruningSkippedReason:
      "Equity retention is table-specific; daily refresh no longer prunes one-year history before coverage verification.",
    futuresStatus: futuresSummary.failedSymbols ? "error" : "success",
    marketAssetsStatus: equitySummary.failedSymbols ? "warning" : "success",
    sp500Status: equityAllFailed ? "error" : "success",
    backfillStatus: equitySummary.symbolsRemaining ? "pending" : "not_requested",
    futures: futuresSummary,
    snapshot,
    elapsedMs: Date.now() - started
  };
  log(
    status === "error" ? "error" : status === "warning" ? "warn" : "info",
    "daily_candle_worker_completed",
    result as any
  );
  return result;
}

export async function refreshCryptoDailyCandles() {
  const db = await verifyCryptoCandleDatabaseReady();
  const configuredSymbols = cryptoCandleEndpointAssets.length;
  if (!db.ok)
    return {
      ok: false,
      partial: false,
      configuredSymbols,
      attemptedSymbols: 0,
      successfulSymbols: 0,
      failedSymbols: configuredSymbols,
      rawRowsFetched: 0,
      validRowsParsed: 0,
      rowsSkipped: 0,
      rowsUpserted: 0,
      rowsVerified: 0,
      rowsPruned: 0,
      failures: [{ symbol: "ALL", stage: "database", message: db.error }],
      perSymbolResults: [],
      pruneCutoff: null
    };
  let rawRowsFetched = 0,
    validRowsParsed = 0,
    rowsSkipped = 0,
    rowsUpserted = 0,
    rowsVerified = 0,
    successfulSymbols = 0;
  const failures: any[] = [];
  const perSymbolResults: any[] = [];
  for (const asset of cryptoCandleEndpointAssets) {
    const fetched = await fetchUnusualWhalesCryptoCandles(asset.symbol, asset.providerSymbol);
    if (!fetched.ok) {
      failures.push({
        symbol: asset.symbol,
        providerSymbol: asset.providerSymbol,
        stage: fetched.stage,
        message: fetched.error
      });
      continue;
    }
    rawRowsFetched += fetched.rawCount;
    validRowsParsed += fetched.parsedCount;
    rowsSkipped += fetched.skippedCount;
    try {
      const up = await upsertDailyCandles("crypto_daily_candles", fetched.candles, db.supabase);
      rowsUpserted += up.upserted;
      const stored = (await readCandlesForApi(
        "crypto_daily_candles",
        asset.symbol,
        "1Y",
        db.supabase
      )) as any[];
      if (!stored.length) throw new Error("Post-upsert verification found zero stored rows");
      rowsVerified += stored.length;
      successfulSymbols++;
      perSymbolResults.push({
        applicationSymbol: asset.symbol,
        providerSymbol: asset.providerSymbol,
        url: fetched.url,
        httpStatus: fetched.status,
        rawRowCount: fetched.rawCount,
        validRowCount: fetched.parsedCount,
        skippedRowCount: fetched.skippedCount,
        upsertedRowCount: up.upserted,
        verifiedStoredRowCount: stored.length,
        storedRowsWithVolume: stored.filter((r) => r.volume != null).length,
        earliestStoredDate: stored[0]?.trading_date ?? null,
        latestStoredDate: stored.at(-1)?.trading_date ?? null,
        failureStage: null,
        failureMessage: null
      });
    } catch (e) {
      failures.push({
        symbol: asset.symbol,
        providerSymbol: asset.providerSymbol,
        stage: "database",
        message: (e as Error).message.slice(0, 300)
      });
    }
  }
  const failedSymbols = configuredSymbols - successfulSymbols;
  let rowsPruned = 0;
  const pruneCutoff = oneYearCutoff();
  if (successfulSymbols > 0)
    rowsPruned = await pruneDailyCandles("crypto_daily_candles", pruneCutoff, db.supabase);
  const ok = successfulSymbols > 0 && rowsUpserted > 0 && rowsVerified > 0;
  return {
    ok,
    partial: ok && failedSymbols > 0,
    configuredSymbols,
    attemptedSymbols: configuredSymbols,
    successfulSymbols,
    failedSymbols,
    rawRowsFetched,
    validRowsParsed,
    rowsSkipped,
    rowsUpserted,
    rowsVerified,
    rowsPruned,
    failures,
    perSymbolResults,
    pruneCutoff
  };
}
