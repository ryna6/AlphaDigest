import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { marketCandleAssets, toUnusualWhalesShareClassSymbol } from "./market-assets";
import {
  getDailyEquityCandleJobs,
  verifyEquityCandleTablesReady,
  type EquityCandleJob
} from "./daily-candle-refresh";
import {
  normalizeUnusualWhalesCandlesWithDiagnostics,
  upsertDailyCandles,
  type CandleTable,
  type DailyCandle
} from "./daily-candles";

export type FailureClass =
  | "rate_limit"
  | "invalid_symbol"
  | "no_data"
  | "malformed_response"
  | "parse_error"
  | "database_error"
  | "verification_error"
  | "timeout";
export const EQUITY_CANDLE_BATCH_SIZE = Math.min(
  5,
  Math.max(1, Number(process.env.EQUITY_CANDLE_BATCH_SIZE ?? 5))
);
export const EQUITY_CANDLE_BACKFILL_DAYS = Math.max(
  370,
  Number(process.env.EQUITY_CANDLE_BACKFILL_DAYS ?? 400)
);
export const EQUITY_CANDLE_DAILY_OVERLAP_DAYS = Number(
  process.env.EQUITY_CANDLE_DAILY_OVERLAP_DAYS ?? 7
);
export const MARKET_REQUIRED_DAILY_ROWS = 253,
  SP500_REQUIRED_DAILY_ROWS = 253,
  SP500_REQUIRED_WEEKLY_ROWS = 201;
const JOB_KEY = "equity-historical-v1",
  LOCK_TIMEOUT_MINUTES = 30;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function equityHistoricalProviderSymbol(symbol: string) {
  return toUnusualWhalesShareClassSymbol(symbol).toUpperCase();
}
export function unusualWhalesEquityHistoricalUrl(symbol: string, from: string, to: string) {
  return `https://phx.unusualwhales.com/api/ticker_candles/${encodeURIComponent(equityHistoricalProviderSymbol(symbol))}/historic/v2?${new URLSearchParams({ interval: "1d", start_date: from, end_date: to, include_1m_data: "false" })}`;
}
export function incrementalFrom(latest: string | null, fallback = "2021-01-01") {
  if (!latest) return fallback;
  const d = new Date(`${latest}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - EQUITY_CANDLE_DAILY_OVERLAP_DAYS);
  return d.toISOString().slice(0, 10);
}
export function defaultBackfillRange(now = new Date()) {
  const to = new Date(now);
  // Public equity candles are only complete through the most recent weekday.
  while (to.getUTCDay() === 0 || to.getUTCDay() === 6) to.setUTCDate(to.getUTCDate() - 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - EQUITY_CANDLE_BACKFILL_DAYS);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
export function resolvedEquityBatchDelayMs(keyCount = 1) {
  return Number(
    process.env.EQUITY_CANDLE_BATCH_DELAY_MS ??
      Math.ceil((60_000 * EQUITY_CANDLE_BATCH_SIZE) / (30 * Math.max(1, keyCount)))
  );
}
export async function processInPacedBatches<T, R>(
  items: T[],
  options: {
    batchSize?: number;
    delayMs?: number;
    worker: (item: T, index: number) => Promise<R>;
    onBatch?: (meta: {
      completedBatches: number;
      remainingSymbols: number;
      estimatedRemainingSymbols: number;
      maxActive: number;
    }) => void;
  }
) {
  const size = Math.min(5, options.batchSize ?? EQUITY_CANDLE_BATCH_SIZE),
    results: R[] = [];
  let maxActive = 0;
  for (let start = 0, b = 0; start < items.length; start += size, b++) {
    let active = 0;
    const rows = await Promise.all(
      items.slice(start, start + size).map((item, i) => {
        active++;
        maxActive = Math.max(maxActive, active);
        return options.worker(item, start + i).finally(() => active--);
      })
    );
    results.push(...rows);
    options.onBatch?.({
      completedBatches: b + 1,
      remainingSymbols: items.length - results.length,
      estimatedRemainingSymbols: items.length - results.length,
      maxActive
    });
    if (start + size < items.length) await sleep(options.delayMs ?? resolvedEquityBatchDelayMs());
  }
  return { results, maxActive };
}
export async function readEquityCoverage(
  table: CandleTable,
  symbols: string[],
  client?: SupabaseClient
) {
  const db = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!db.ok) throw new Error(db.message);
  if (!symbols.length) return [];
  const { data, error } = await (db.client.from(table) as any)
    .select(
      table === "sp500_daily_candles"
        ? "symbol,trading_date,fetched_at"
        : "symbol,provider_symbol,trading_date,source,fetched_at"
    )
    .in("symbol", symbols);
  if (error) throw new Error(error.message);
  const map = new Map(
    symbols.map((symbol) => [
      symbol,
      {
        symbol,
        rowCount: 0,
        earliest: null as string | null,
        latest: null as string | null,
        providerSymbols: new Set<string>(),
        sources: new Set<string>(),
        latestFetchedAt: null as string | null
      }
    ])
  );
  for (const r of data ?? []) {
    const x = map.get(r.symbol);
    if (!x) continue;
    x.rowCount++;
    x.earliest = !x.earliest || r.trading_date < x.earliest ? r.trading_date : x.earliest;
    x.latest = !x.latest || r.trading_date > x.latest ? r.trading_date : x.latest;
    if (table === "sp500_daily_candles") x.providerSymbols.add(r.symbol);
    else if (r.provider_symbol) x.providerSymbols.add(r.provider_symbol);
    if (table === "sp500_daily_candles") x.sources.add("Unusual Whales Equity");
    else if (r.source) x.sources.add(r.source);
    x.latestFetchedAt =
      !x.latestFetchedAt || r.fetched_at > x.latestFetchedAt ? r.fetched_at : x.latestFetchedAt;
  }
  return [...map.values()].map((x) => ({
    ...x,
    providerSymbols: [...x.providerSymbols],
    sources: [...x.sources]
  }));
}
function providerFailure(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const message = [p.error, p.message, p.detail, p.reason].find((x) => typeof x === "string");
  if (
    p.success === false ||
    (message &&
      !(
        Array.isArray(p.data) ||
        Array.isArray(p.candles) ||
        Array.isArray(p.results) ||
        Array.isArray(p.payload)
      ))
  )
    return String(message ?? "Provider returned success: false").slice(0, 240);
  return null;
}
function classify(status: number, text: string): FailureClass {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "malformed_response";
  if (status === 400 || status === 404) return "invalid_symbol";
  return status >= 500 ? "timeout" : "malformed_response";
}
export async function fetchUnusualWhalesEquityHistoricalCandles(
  job: EquityCandleJob,
  from: string,
  to: string
) {
  const providerSymbol = equityHistoricalProviderSymbol(job.symbol),
    url = unusualWhalesEquityHistoricalUrl(job.symbol, from, to);
  let retries = 0;
  for (;;) {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "AlphaDigest/1.0 server-side equity ingestion"
      }
    });
    const text = await res.text();
    console.info("equity_provider_request_completed", {
      symbol: job.symbol,
      providerSymbol,
      url,
      status: res.status,
      responseBytes: Buffer.byteLength(text)
    });
    if (!res.ok) {
      const c = classify(res.status, text);
      if ((c === "rate_limit" || res.status >= 500) && retries++ < 3) {
        const retry = Number(res.headers.get("retry-after") ?? 0);
        await sleep(retry ? retry * 1000 : 1000 * 2 ** retries);
        continue;
      }
      const e: any = new Error(`Provider ${res.status}`);
      e.classification = c;
      throw e;
    }
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      const e: any = new Error("Provider returned non-JSON response");
      e.classification = "malformed_response";
      throw e;
    }
    const envelope = providerFailure(payload);
    if (envelope) {
      const e: any = new Error(envelope);
      e.classification = "malformed_response";
      throw e;
    }
    const parsed = normalizeUnusualWhalesCandlesWithDiagnostics(
      job.symbol,
      providerSymbol,
      payload,
      "Unusual Whales Equity"
    );
    console.info("equity_provider_response_parsed", {
      symbol: job.symbol,
      providerSymbol,
      arrayPath: parsed.arrayPath,
      rawRows: parsed.rawCount,
      parsedRows: parsed.parsedCount,
      skippedRows: parsed.skippedCount
    });
    if (!parsed.rawCount || !parsed.parsedCount) {
      const e: any = new Error(
        !parsed.rawCount
          ? "no_data: provider returned zero candle rows"
          : "parse_error: no valid candle rows"
      );
      e.classification = !parsed.rawCount ? "no_data" : "parse_error";
      throw e;
    }
    return { ...parsed, providerSymbol, url, httpStatus: res.status, retries };
  }
}
type State = {
  job_key: string;
  symbol: string;
  table_name: CandleTable;
  requested_from: string;
  requested_to: string;
  latest_completed_date: string | null;
  status: string;
  attempt_count: number;
  lock_token: string | null;
};
export async function initializeBackfillState(
  jobs: EquityCandleJob[],
  from: string,
  to: string,
  client: SupabaseClient,
  resetFailed = false
) {
  const rows = jobs.map((j) => ({
    job_key: JOB_KEY,
    symbol: j.symbol,
    table_name: j.table,
    requested_from: from,
    requested_to: to,
    status: "pending"
  }));
  if (!rows.length) return 0;
  // Do not update existing rows: completed checkpoints and their wider ranges are immutable.
  const { error } = await client
    .from("equity_candle_backfill_state")
    .upsert(rows, { onConflict: "job_key,symbol,table_name", ignoreDuplicates: true });
  if (error) throw new Error(`Backfill state initialization failed: ${error.message}`);
  if (resetFailed) {
    for (const job of jobs) {
      const { error: resetError } = await client
        .from("equity_candle_backfill_state")
        .update({ status: "pending", last_error: null, lock_token: null, locked_at: null })
        .eq("job_key", JOB_KEY)
        .eq("symbol", job.symbol)
        .eq("table_name", job.table)
        .eq("status", "failed");
      if (resetError) throw new Error(`Backfill failed-state reset failed: ${resetError.message}`);
    }
  }
  const { count, error: readError } = await client
    .from("equity_candle_backfill_state")
    .select("*", { count: "exact", head: true })
    .eq("job_key", JOB_KEY)
    .in(
      "symbol",
      jobs.map((j) => j.symbol)
    );
  if (readError) throw new Error(`Backfill state verification failed: ${readError.message}`);
  return count ?? 0;
}
export async function claimBackfillBatch(
  client: SupabaseClient,
  limit: number,
  table?: CandleTable,
  symbols?: string[]
) {
  const token = crypto.randomUUID();
  const { data, error } = await client.rpc("claim_equity_candle_backfill_batch", {
    p_job_key: JOB_KEY,
    p_limit: Math.min(5, limit),
    p_lock_token: token,
    p_lock_timeout_minutes: LOCK_TIMEOUT_MINUTES,
    p_table_name: table ?? null,
    p_symbols: symbols?.length ? symbols : null
  });
  if (error) throw new Error(`Backfill claim failed: ${error.message}`);
  return (data ?? []) as State[];
}
async function updateState(client: SupabaseClient, s: State, values: Record<string, unknown>) {
  const { error } = await client
    .from("equity_candle_backfill_state")
    .update(values)
    .eq("job_key", s.job_key)
    .eq("symbol", s.symbol)
    .eq("table_name", s.table_name)
    .eq("lock_token", s.lock_token!);
  if (error) throw new Error(`Backfill state update failed: ${error.message}`);
}
async function verifyStored(
  table: CandleTable,
  symbol: string,
  from: string,
  latestParsed: string,
  client: SupabaseClient
) {
  const { data, error } = await client
    .from(table)
    .select("trading_date")
    .eq("symbol", symbol)
    .gte("trading_date", from)
    .order("trading_date");
  if (error) throw new Error(error.message);
  const dates = (data ?? []).map((r) => r.trading_date);
  const duplicateCount = dates.length - new Set(dates).size;
  return {
    storedRows: dates.length,
    earliestStoredDate: dates[0] ?? null,
    latestStoredDate: dates.at(-1) ?? null,
    duplicateCount,
    coverageSatisfied:
      dates.length >= 253 &&
      dates.at(-1) !== undefined &&
      dates.at(-1)! >= latestParsed &&
      duplicateCount === 0
  };
}
export async function runEquityCandleRefresh(
  options: {
    mode: "daily" | "backfill";
    table?: "market_daily_candles" | "sp500_daily_candles";
    symbol?: string;
    symbols?: string[];
    from?: string;
    to?: string;
    limitSymbols?: number;
    dryRun?: boolean;
    resetFailed?: boolean;
    client?: SupabaseClient;
  } = { mode: "daily" }
) {
  const db = await verifyEquityCandleTablesReady(options.client);
  if (!db.ok) throw new Error("Equity candle tables unavailable");
  const all = (await getDailyEquityCandleJobs(db.supabase)).jobs.filter(
    (j) =>
      j.symbol !== "ES=F" &&
      marketCandleAssets.find((a) => a.symbol === j.symbol)?.providerKind !==
        "unusual_whales_futures"
  );
  let selected = all.filter(
    (j) =>
      (!options.table || j.table === options.table) &&
      (!options.symbol || j.symbol === options.symbol) &&
      (!options.symbols?.length || options.symbols.includes(j.symbol))
  );
  const defaultRange = defaultBackfillRange();
  const to = options.to ?? defaultRange.to,
    from = options.from ?? defaultRange.from;
  let initialized = 0,
    claimed: State[] = [];
  if (options.mode === "backfill") {
    initialized = await initializeBackfillState(
      selected,
      from,
      to,
      db.supabase,
      options.resetFailed
    );
    claimed = await claimBackfillBatch(
      db.supabase,
      options.limitSymbols ?? EQUITY_CANDLE_BATCH_SIZE,
      options.table,
      options.symbols ?? (options.symbol ? [options.symbol] : undefined)
    );
    selected = claimed
      .map((s) => all.find((j) => j.symbol === s.symbol && j.table === s.table_name)!)
      .filter(Boolean);
  } else if (options.limitSymbols) selected = selected.slice(0, options.limitSymbols);
  const coverageByTable = new Map<string, any>();
  for (const table of ["market_daily_candles", "sp500_daily_candles"] as const) {
    for (const c of await readEquityCoverage(
      table,
      selected.filter((j) => j.table === table).map((j) => j.symbol),
      db.supabase
    ))
      coverageByTable.set(`${table}:${c.symbol}`, c);
  }
  let fetched = 0,
    parsed = 0,
    skipped = 0,
    upserted = 0,
    verified = 0,
    completed = 0,
    failed = 0,
    retries = 0,
    maxActive = 0;
  const failures: any[] = [];
  for (let i = 0; i < selected.length; i += EQUITY_CANDLE_BATCH_SIZE) {
    let active = 0;
    await Promise.all(
      selected.slice(i, i + EQUITY_CANDLE_BATCH_SIZE).map(async (job) => {
        active++;
        maxActive = Math.max(maxActive, active);
        const state = claimed.find((s) => s.symbol === job.symbol && s.table_name === job.table);
        try {
          const requestFrom =
            options.mode === "backfill"
              ? state?.latest_completed_date
                ? incrementalFrom(state.latest_completed_date, state.requested_from)
                : (state?.requested_from ?? from)
              : (options.from ??
                incrementalFrom(
                  coverageByTable.get(`${job.table}:${job.symbol}`)?.latest,
                  defaultRange.from
                ));
          const x = await fetchUnusualWhalesEquityHistoricalCandles(job, requestFrom, to);
          fetched += x.rawCount;
          parsed += x.parsedCount;
          skipped += x.skippedCount;
          retries += x.retries;
          if (!options.dryRun) {
            const write = await upsertDailyCandles(job.table, x.candles, db.supabase);
            upserted += write.upserted;
            console.info("equity_candle_upsert_completed", {
              symbol: job.symbol,
              table: job.table,
              upsertedRows: write.upserted
            });
          }
          const v = options.dryRun
            ? {
                storedRows: 0,
                earliestStoredDate: null,
                latestStoredDate: null,
                duplicateCount: 0,
                coverageSatisfied: true
              }
            : await verifyStored(
                job.table,
                job.symbol,
                requestFrom,
                x.candles.at(-1)!.tradingDate,
                db.supabase
              );
          console.info("equity_candle_verification_completed", {
            symbol: job.symbol,
            table: job.table,
            ...v
          });
          if (!v.coverageSatisfied)
            throw Object.assign(new Error("Post-write verification failed"), {
              classification: "verification_error"
            });
          verified += v.storedRows;
          if (state && !options.dryRun) {
            await updateState(db.supabase, state, {
              latest_completed_date: v.latestStoredDate,
              status: v.latestStoredDate! >= state.requested_to ? "completed" : "pending",
              lock_token: null,
              locked_at: null,
              completed_at:
                v.latestStoredDate! >= state.requested_to ? new Date().toISOString() : null,
              last_error: null
            });
            if (v.latestStoredDate! >= state.requested_to) completed++;
          }
        } catch (e: any) {
          failed++;
          failures.push({
            symbol: job.symbol,
            table: job.table,
            classification: e.classification ?? "database_error",
            message: String(e.message).slice(0, 240)
          });
          if (state)
            await updateState(db.supabase, state, {
              status: "failed",
              last_error: String(e.message).slice(0, 500),
              lock_token: null,
              locked_at: null
            });
        } finally {
          active--;
        }
      })
    );
    if (i + EQUITY_CANDLE_BATCH_SIZE < selected.length) await sleep(resolvedEquityBatchDelayMs());
  }
  // Daily mode deliberately does not touch checkpoint state; it only reports coverage debt.
  let remaining = 0;
  if (options.mode === "backfill") {
    const { count } = await db.supabase
      .from("equity_candle_backfill_state")
      .select("*", { count: "exact", head: true })
      .eq("job_key", JOB_KEY)
      .neq("status", "completed");
    remaining = count ?? 0;
  }
  const dailyCoverage =
    options.mode === "daily"
      ? await Promise.all(
          (["market_daily_candles", "sp500_daily_candles"] as const).map(async (table) =>
            readEquityCoverage(
              table,
              all.filter((job) => job.table === table).map((job) => job.symbol),
              db.supabase
            )
          )
        )
      : [];
  const dailyRows = dailyCoverage.flat();
  const symbolsHistoricallyComplete = dailyRows.filter((row) => row.rowCount >= 253).length;
  const symbolsRequiringBackfill = dailyRows.filter((row) => row.rowCount < 253).length;
  const symbolsWithOneRow = dailyRows.filter((row) => row.rowCount === 1).length;
  const symbolsWithFewerThan200Rows = dailyRows.filter((row) => row.rowCount < 200).length;
  return {
    mode: options.mode,
    batchSize: EQUITY_CANDLE_BATCH_SIZE,
    batchDelayMs: resolvedEquityBatchDelayMs(),
    configuredSymbols: all.length,
    attemptedSymbols: selected.length,
    successfulSymbols: selected.length - failed,
    failedSymbols: failed,
    symbolsInitialized: initialized,
    symbolsClaimed: claimed.length,
    symbolsCompleted: completed,
    symbolsFailed: failed,
    symbolsRemaining: remaining ?? 0,
    symbolsAlreadyComplete: 0,
    historicalRowsFetched: fetched,
    historicalRowsParsed: parsed,
    rowsSkipped: skipped,
    rowsUpserted: upserted,
    rowsVerified: verified,
    rateLimitRetries: retries,
    providerErrors: failures.filter((x) => x.classification !== "database_error"),
    databaseErrors: failures.filter((x) => x.classification === "database_error"),
    verificationErrors: failures.filter((x) => x.classification === "verification_error"),
    highestObservedConcurrentRequests: maxActive,
    symbolsCurrent: options.mode === "daily" ? selected.length - failed : 0,
    symbolsHistoricallyComplete,
    symbolsRequiringBackfill,
    symbolsStale: 0,
    symbolsWithOneRow,
    symbolsWithFewerThan200Rows
  };
}
