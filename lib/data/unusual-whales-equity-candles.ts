import { createServerSupabaseClient } from "@/lib/db/supabase";
import { normalizeUnusualWhalesCandlesWithDiagnostics, type DailyCandle } from "./daily-candles";
import { toUnusualWhalesShareClassSymbol } from "./market-assets";

export const UW_EQUITY_CANDLE_BASE_URL = "https://phx.unusualwhales.com/api/ticker_candles";
export function equityProviderTicker(symbol: string) {
  return toUnusualWhalesShareClassSymbol(symbol).toUpperCase();
}
export function buildUnusualWhalesEquityCandleUrl(providerTicker: string) {
  return `${UW_EQUITY_CANDLE_BASE_URL}/${encodeURIComponent(providerTicker.toUpperCase())}/historic/v2?interval=1y&include_1m_data=true`;
}
function bounded(s: string, n = 240) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function providerMessage(json: unknown) {
  return isRecord(json)
    ? ([json.error, json.message, json.detail, json.reason].find(
        (v): v is string => typeof v === "string" && v.trim().length > 0
      ) ?? null)
    : null;
}
export type EquityCandleFetchResult =
  | {
      ok: true;
      symbol: string;
      providerSymbol: string;
      url: string;
      status: number;
      finalUrl: string;
      contentType: string | null;
      responseLength: number;
      rawCount: number;
      parsedCount: number;
      skippedCount: number;
      candles: DailyCandle[];
      diagnostics: { arrayPath: string; topLevelType: string; topLevelKeys: string[] };
    }
  | {
      ok: false;
      symbol: string;
      providerSymbol: string;
      url: string;
      status?: number;
      finalUrl?: string;
      contentType?: string | null;
      responseLength?: number;
      stage:
        | "request"
        | "http"
        | "response_type"
        | "json"
        | "provider"
        | "parse"
        | "database"
        | "verification";
      error: string;
      diagnostics?: Record<string, unknown>;
    };
export async function fetchUnusualWhalesEquityCandles(
  symbol: string,
  providerSymbol = equityProviderTicker(symbol)
): Promise<EquityCandleFetchResult> {
  const url = buildUnusualWhalesEquityCandleUrl(providerSymbol);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "AlphaDigest/1.0 (+server-side equity candle backfill)"
  };
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", headers });
  } catch (e) {
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      stage: "request",
      error: bounded((e as Error).message)
    };
  }
  const text = await res.text();
  const contentType = res.headers.get("content-type");
  const diagnostics = { contentType, responseLength: text.length, finalUrl: res.url };
  if (!res.ok)
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      status: res.status,
      stage: "http",
      error: `Unusual Whales equity HTTP ${res.status}`,
      ...diagnostics
    };
  if (/^\s*</.test(text) || contentType?.toLowerCase().includes("text/html"))
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      status: res.status,
      stage: "response_type",
      error: "Unusual Whales equity endpoint returned HTML instead of JSON",
      ...diagnostics
    };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      status: res.status,
      stage: "json",
      error: bounded((e as Error).message),
      ...diagnostics
    };
  }
  const msg = providerMessage(json);
  if (
    msg &&
    !Array.isArray(json) &&
    !(isRecord(json) && (Array.isArray(json.data) || Array.isArray(json.payload)))
  )
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      status: res.status,
      stage: "provider",
      error: bounded(msg),
      diagnostics: {
        ...diagnostics,
        topLevelKeys: isRecord(json) ? Object.keys(json).slice(0, 20) : []
      }
    };
  const parsed = normalizeUnusualWhalesCandlesWithDiagnostics(
    symbol,
    providerSymbol,
    json,
    "Unusual Whales Equity"
  );
  const topLevelType = Array.isArray(json) ? "array" : isRecord(json) ? "object" : typeof json;
  const topLevelKeys = isRecord(json) ? Object.keys(json).slice(0, 20) : [];
  if (parsed.rawCount === 0)
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      status: res.status,
      stage: "parse",
      error: "Unusual Whales equity response contained zero candle rows",
      diagnostics: { ...diagnostics, arrayPath: parsed.arrayPath, topLevelType, topLevelKeys }
    };
  if (parsed.parsedCount === 0)
    return {
      ok: false,
      symbol,
      providerSymbol,
      url,
      status: res.status,
      stage: "parse",
      error: "Unusual Whales equity response produced zero valid candle rows",
      diagnostics: {
        ...diagnostics,
        arrayPath: parsed.arrayPath,
        skippedReasons: parsed.skippedReasons,
        rawCount: parsed.rawCount,
        topLevelType,
        topLevelKeys
      }
    };
  return {
    ok: true,
    symbol,
    providerSymbol,
    url,
    status: res.status,
    finalUrl: res.url,
    contentType,
    responseLength: text.length,
    rawCount: parsed.rawCount,
    parsedCount: parsed.parsedCount,
    skippedCount: parsed.skippedCount,
    candles: parsed.candles,
    diagnostics: { arrayPath: parsed.arrayPath, topLevelType, topLevelKeys }
  };
}
export async function verifyEquityCandleDatabaseReady() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false as const, error: supabase.message };
  for (const table of ["sp500_daily_candles", "market_daily_candles"] as const) {
    const columns =
      table === "sp500_daily_candles"
        ? "symbol,trading_date,open,high,low,close,volume,previous_close,fetched_at"
        : "symbol,provider_symbol,trading_date,open,high,low,close,volume,previous_close,source,fetched_at";
    const { error } = await supabase.client.from(table).select(columns).limit(0);
    if (error)
      return {
        ok: false as const,
        error: `${table} is unavailable or volume migration is missing. ${JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint })}`
      };
  }
  return { ok: true as const, supabase: supabase.client };
}
