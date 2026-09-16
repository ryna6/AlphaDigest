import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { upsertDailyCandles, type DailyCandle } from "./daily-candles";

export const SP500_FUTURES_HISTORY_ID = "09abc102-cb07-420e-92c6-e220f44c1e81";
export const SP500_FUTURES_HISTORY_URL = `https://phx.unusualwhales.com/api/futures_eod_history/${SP500_FUTURES_HISTORY_ID}`;
export const SP500_FUTURES_SOURCE = "Unusual Whales Futures EOD";
export const FUTURES_TIMEZONE = "America/New_York";
const APP_SYMBOL = "ES=F";

type SkipReasons = Record<string, number>;
type Located = { rows: unknown[]; path: string };
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) =>
  typeof v === "number"
    ? Number.isFinite(v)
      ? v
      : null
    : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : null;
const inc = (r: SkipReasons, k: string) => {
  r[k] = (r[k] ?? 0) + 1;
};

export function locateFuturesCandleArray(payload: unknown): Located {
  const paths: Array<[string, unknown]> = [["$", payload]];
  if (isRecord(payload)) {
    paths.push(
      ["payload", payload.payload],
      ["data", payload.data],
      ["history", payload.history],
      ["results", payload.results]
    );
    if (isRecord(payload.payload))
      paths.push(
        ["payload.data", payload.payload.data],
        ["payload.history", payload.payload.history],
        ["payload.results", payload.payload.results]
      );
    if (isRecord(payload.data))
      paths.push(["data.history", payload.data.history], ["data.results", payload.data.results]);
  }
  for (const [path, value] of paths) if (Array.isArray(value)) return { rows: value, path };
  return { rows: [], path: "not_found" };
}

function easternDate(raw: unknown): { tradingDate: string; sourceTimestamp: string } | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { tradingDate: s, sourceTimestamp: s };
  const ms =
    typeof raw === "number" || /^\d+$/.test(s)
      ? Number(s) * (Number(s) > 10_000_000_000 ? 1 : 1000)
      : Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return {
    tradingDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: FUTURES_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(ms)),
    sourceTimestamp: new Date(ms).toISOString()
  };
}
function isoDow(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
function addYears(date: string, years: number) {
  const [y, m, d] = date.split("-").map(Number);
  const days = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return new Date(Date.UTC(y + years, m - 1, Math.min(d, days))).toISOString().slice(0, 10);
}
export function retainTrailingFuturesYear(candles: DailyCandle[]) {
  if (!candles.length) return [];
  const latest = candles.at(-1)!.tradingDate;
  const cutoff = addYears(latest, -1);
  return candles.filter((c) => c.tradingDate >= cutoff && c.tradingDate <= latest);
}

export function parseUnusualWhalesFuturesCandles(
  payload: unknown,
  fetchedAt = new Date().toISOString()
) {
  const { rows, path } = locateFuturesCandleArray(payload);
  const skippedReasons: SkipReasons = {};
  const parsed: DailyCandle[] = [];
  for (const raw of rows) {
    if (!isRecord(raw)) {
      inc(skippedReasons, "row_not_object");
      continue;
    }
    const d = easternDate(raw.date);
    if (!d) {
      inc(skippedReasons, "missing_or_malformed_date");
      continue;
    }
    const dow = isoDow(d.tradingDate);
    if (dow === 6) {
      inc(skippedReasons, "saturday_row_skipped");
      continue;
    }
    const open = num(raw.open),
      high = num(raw.high),
      low = num(raw.low),
      close = num(raw.close);
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0
    ) {
      inc(skippedReasons, "missing_positive_ohlc");
      continue;
    }
    if (high < open || high < close || low > open || low > close || high < low) {
      inc(skippedReasons, "invalid_ohlc_relationship");
      continue;
    }
    parsed.push({
      symbol: APP_SYMBOL,
      providerSymbol: SP500_FUTURES_HISTORY_ID,
      tradingDate: d.tradingDate,
      open,
      high,
      low,
      close,
      volume: null,
      previousClose: null,
      source: SP500_FUTURES_SOURCE,
      sourceTimestamp: d.sourceTimestamp,
      fetchedAt
    });
  }
  parsed.sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
  const deduped = parsed.filter(
    (c, i, a) => i === a.findIndex((x) => x.tradingDate === c.tradingDate)
  );
  deduped.forEach((c, i) => {
    c.previousClose = i ? deduped[i - 1].close : null;
  });
  if (rows.length > 0 && deduped.length === 0)
    throw new Error("Unusual Whales futures returned rows but zero valid candles parsed");
  if (path === "not_found")
    throw new Error("Unusual Whales futures response did not contain a candle array");
  if (rows.length === 0) throw new Error("Unusual Whales futures returned zero rows");
  const retained = retainTrailingFuturesYear(deduped);
  return {
    candles: retained,
    allValidCandles: deduped,
    rawCount: rows.length,
    parsedCount: deduped.length,
    retainedCount: retained.length,
    skippedCount: rows.length - deduped.length,
    skippedReasons,
    arrayPath: path,
    saturdayRowsSkipped: skippedReasons.saturday_row_skipped ?? 0
  };
}

export async function fetchUnusualWhalesFuturesPayload() {
  const headers: HeadersInit = {
    Accept: "application/json",
    "User-Agent": "AlphaDigest/1.0 server-side futures ingestion"
  };
  const res = await fetch(SP500_FUTURES_HISTORY_URL, { headers, cache: "no-store" });
  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unusual Whales futures returned non-JSON status ${res.status}`);
  }
  if (!res.ok) throw new Error(`Unusual Whales futures HTTP ${res.status}`);
  return {
    payload,
    status: res.status,
    url: SP500_FUTURES_HISTORY_URL,
    finalUrl: res.url,
    contentType: res.headers.get("content-type"),
    byteLength: Buffer.byteLength(text)
  };
}

export async function verifyFuturesStoredRows(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) throw new Error(supabase.message);
  const { data, error } = await supabase.client
    .from("market_daily_candles")
    .select("symbol,provider_symbol,trading_date,volume")
    .eq("symbol", APP_SYMBOL)
    .order("trading_date", { ascending: true });
  if (error) throw new Error(`Supabase futures verify failed: ${error.message}`);
  const rows = data ?? [];
  const dates = rows.map((r: any) => r.trading_date);
  return {
    rows,
    rowCount: rows.length,
    earliestStoredDate: dates[0] ?? null,
    latestStoredDate: dates.at(-1) ?? null,
    sundayRows: rows.filter((r: any) => isoDow(r.trading_date) === 0).length,
    saturdayRows: rows.filter((r: any) => isoDow(r.trading_date) === 6).length,
    nullVolumeRows: rows.filter((r: any) => r.volume == null).length,
    duplicateCount: rows.length - new Set(dates).size
  };
}
export async function pruneOlderSp500FuturesRows(cutoff: string, client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) throw new Error(supabase.message);
  const { count, error } = await supabase.client
    .from("market_daily_candles")
    .delete({ count: "exact" })
    .eq("symbol", APP_SYMBOL)
    .lt("trading_date", cutoff);
  if (error) throw new Error(`Supabase futures prune failed: ${error.message}`);
  return count ?? 0;
}
export async function refreshSp500FuturesCandles(client?: SupabaseClient) {
  const summary = {
    configuredSymbols: 1,
    attemptedSymbols: 1,
    successfulSymbols: 0,
    failedSymbols: 0,
    rawRowsFetched: 0,
    validRowsParsed: 0,
    rowsSkipped: 0,
    rowsUpserted: 0,
    rowsVerified: 0,
    earliestStoredDate: null as string | null,
    latestStoredDate: null as string | null,
    sundayRowsStored: 0,
    saturdayRowsSkipped: 0,
    failure: null as string | null
  };
  try {
    const fetched = await fetchUnusualWhalesFuturesPayload();
    const parsed = parseUnusualWhalesFuturesCandles(fetched.payload);
    summary.rawRowsFetched = parsed.rawCount;
    summary.validRowsParsed = parsed.parsedCount;
    summary.rowsSkipped = parsed.skippedCount;
    summary.saturdayRowsSkipped = parsed.saturdayRowsSkipped;
    const up = await upsertDailyCandles("market_daily_candles", parsed.candles, client);
    summary.rowsUpserted = up.upserted;
    if (parsed.candles[0]) await pruneOlderSp500FuturesRows(parsed.candles[0].tradingDate, client);
    const verify = await verifyFuturesStoredRows(client);
    if (!verify.rowCount) throw new Error("Post-upsert verification found zero ES=F rows");
    summary.rowsVerified = verify.rowCount;
    summary.earliestStoredDate = verify.earliestStoredDate;
    summary.latestStoredDate = verify.latestStoredDate;
    summary.sundayRowsStored = verify.sundayRows;
    summary.successfulSymbols = 1;
    return summary;
  } catch (e) {
    summary.failedSymbols = 1;
    summary.failure = (e as Error).message.slice(0, 300);
    return summary;
  }
}
