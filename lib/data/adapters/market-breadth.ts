import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

const TABLE = "market_breadth";
const SOURCE = "market_breadth";
const FETCH_TIMEOUT_MS = 15_000;

export type BreadthOhlc = { timestamp: number; open: number; high: number; low: number; close: number };
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

export const INVESTING_BREADTH_SOURCES = {
  above50d: { metric: "% Above 50D MA", id: "1225324", url: "https://api.investing.com/api/financialdata/1225324/historical/chart/?interval=P1D&pointscount=160" },
  above200d: { metric: "% Above 200D MA", id: "1225364", url: "https://api.investing.com/api/financialdata/1225364/historical/chart/?interval=P1D&pointscount=160" }
} as const;

export const YAHOO_52_WEEK_SOURCES = {
  highs: { metric: "52W Highs", scrId: "recent_52_week_highs", url: "https://query1.finance.yahoo.com/v1/finance/screener?formatted=true&useRecordsResponse=true&lang=en-CA&region=CA" },
  lows: { metric: "52W Lows", scrId: "recent_52_week_lows", url: "https://query1.finance.yahoo.com/v1/finance/screener?formatted=true&useRecordsResponse=true&lang=en-CA&region=CA" }
} as const;

export const MARKET_BREADTH_SOURCE_URL = [...Object.values(INVESTING_BREADTH_SOURCES), ...Object.values(YAHOO_52_WEEK_SOURCES)].map((source) => source.url).join(",");

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const JSON_HEADERS = { "user-agent": USER_AGENT, accept: "application/json", "accept-language": "en-CA,en-US;q=0.9,en;q=0.8", "cache-control": "no-cache" } as const;

export type ParsedMarketBreadth = {
  above50d: BreadthOhlc;
  above200d: BreadthOhlc;
  highs52w: number;
  lows52w: number;
  sourceUpdatedAt: string | null;
  movingAverageSource: string;
  highLowSource: string;
};

export type MarketBreadthSnapshot = ParsedMarketBreadth & { id: string; sourceUrl: string; fetchedAt: string; contentHash: string };

export type ProviderDiagnostics = { url: string; status?: number; contentType?: string; finalUrl?: string; responseLength?: number; appearsBlocked?: boolean; method: string; provider?: string; screenerId?: string; crumbRefreshed?: boolean };

function finiteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function rowsFromInvestingPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRec(payload)) {
    for (const key of ["data", "rows", "result"]) if (Array.isArray(payload[key])) return payload[key] as unknown[];
  }
  throw new Error("Investing.com breadth response does not contain an array of rows.");
}

function validateOhlc(row: BreadthOhlc) {
  for (const [key, value] of Object.entries(row)) if (!Number.isFinite(value)) throw new Error(`Investing.com ${key} is not finite.`);
  for (const key of ["open", "high", "low", "close"] as const) if (row[key] < 0 || row[key] > 100) throw new Error(`Investing.com ${key} is outside 0-100.`);
  if (row.high < row.open || row.high < row.close || row.low > row.open || row.low > row.close || row.high < row.low) throw new Error("Investing.com OHLC row violates basic high/low consistency.");
}

export function parseLatestInvestingBreadthRow(payload: unknown): BreadthOhlc {
  let latest: BreadthOhlc | null = null;
  for (const raw of rowsFromInvestingPayload(payload)) {
    if (!Array.isArray(raw) || raw.length < 5) continue;
    const [timestamp, open, high, low, close] = raw.map(finiteNumber);
    if (timestamp == null || open == null || high == null || low == null || close == null) continue;
    const row = { timestamp, open, high, low, close };
    try { validateOhlc(row); } catch { continue; }
    if (!latest || row.timestamp > latest.timestamp) latest = row;
  }
  if (!latest) throw new Error("Investing.com breadth response contained no valid OHLC rows.");
  return latest;
}

export function parseYahooScreenerTotal(payload: unknown): number {
  if (!isRec(payload) || !isRec(payload.finance)) throw new Error("Yahoo Finance screener response is missing finance.result.");
  if (payload.finance.error) throw new Error(`Yahoo Finance screener returned an error: ${JSON.stringify(payload.finance.error)}`);
  if (!Array.isArray(payload.finance.result)) throw new Error("Yahoo Finance screener response is missing finance.result.");
  if (payload.finance.result.length === 0) throw new Error("Yahoo Finance screener response has an empty result array.");
  const first = payload.finance.result[0];
  if (!isRec(first) || !("total" in first)) throw new Error("Yahoo Finance screener result is missing total.");
  const total = finiteNumber(first.total);
  if (total == null || !Number.isInteger(total) || total < 0) throw new Error("Yahoo Finance screener total must be a finite non-negative integer.");
  return total;
}

export function yahooScreenerRequest(scrId: string, crumb?: string) {
  const url = crumb ? `${YAHOO_52_WEEK_SOURCES.highs.url}&crumb=${encodeURIComponent(crumb)}` : YAHOO_52_WEEK_SOURCES.highs.url;
  return { url, body: { scrIds: scrId, count: 100, start: 0 } };
}

function looksLikeBlock(text: string) { return /captcha|cloudflare|access denied|verify you are human|unusual traffic|enable javascript and cookies/i.test(text); }

async function fetchJsonWithTimeout(url: string, init: RequestInit, provider: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", redirect: "follow", signal: controller.signal });
    const text = await response.text();
    const diagnostic: ProviderDiagnostics = { url, status: response.status, contentType: response.headers.get("content-type") ?? undefined, finalUrl: response.url, responseLength: text.length, appearsBlocked: looksLikeBlock(text), method: init.method ?? "GET", provider };
    if (!response.ok || diagnostic.appearsBlocked) throw new Error(`${provider} fetch failed: ${JSON.stringify(diagnostic)}`);
    if (/html/i.test(diagnostic.contentType ?? "") || /^\s*</.test(text)) throw new Error(`${provider} returned HTML instead of JSON: ${JSON.stringify(diagnostic)}`);
    try { return { json: JSON.parse(text), diagnostic }; } catch { throw new Error(`${provider} returned malformed JSON: ${JSON.stringify(diagnostic)}`); }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`${provider} fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function fetchInvestingBreadthOhlc(source: typeof INVESTING_BREADTH_SOURCES[keyof typeof INVESTING_BREADTH_SOURCES]) {
  const { json } = await fetchJsonWithTimeout(source.url, { headers: { ...JSON_HEADERS, referer: "https://www.investing.com/" } }, "Investing.com");
  return parseLatestInvestingBreadthRow(json);
}

async function fetchYahooCrumb() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { cache: "no-store", headers: JSON_HEADERS, signal: controller.signal });
    const text = await response.text();
    if (!response.ok || looksLikeBlock(text) || /^\s*</.test(text)) return undefined;
    const crumb = text.trim();
    return crumb && !/\s/.test(crumb) ? crumb : undefined;
  } catch {
    return undefined;
  } finally { clearTimeout(timeout); }
}

export async function fetchYahooScreenerTotal(scrId: string) {
  let crumb: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { url, body } = yahooScreenerRequest(scrId, crumb);
    try {
      const { json } = await fetchJsonWithTimeout(url, { method: "POST", headers: { ...JSON_HEADERS, "content-type": "application/json", origin: "https://finance.yahoo.com", referer: "https://finance.yahoo.com/research-hub/screener/" }, body: JSON.stringify(body) }, "Yahoo Finance screener");
      return parseYahooScreenerTotal(json);
    } catch (error) {
      if (attempt === 0) { crumb = await fetchYahooCrumb(); if (crumb) continue; }
      throw error;
    }
  }
  throw new Error("Yahoo Finance screener fetch failed.");
}

export function validateMarketBreadth(snapshot: ParsedMarketBreadth) {
  validateOhlc(snapshot.above50d); validateOhlc(snapshot.above200d);
  if (!Number.isInteger(snapshot.highs52w) || snapshot.highs52w < 0) throw new Error("Market breadth 52-week highs count is invalid.");
  if (!Number.isInteger(snapshot.lows52w) || snapshot.lows52w < 0) throw new Error("Market breadth 52-week lows count is invalid.");
}

export function createMarketBreadthSnapshot(values: ParsedMarketBreadth, fetchedAt = new Date().toISOString()): MarketBreadthSnapshot {
  validateMarketBreadth(values);
  const sourceUrl = MARKET_BREADTH_SOURCE_URL;
  return { id: "sp500", ...values, sourceUrl, fetchedAt, contentHash: stableHash({ ...values, sourceUrl }) };
}

export async function buildMarketBreadthSnapshot() {
  const [above50d, above200d, highs52w, lows52w] = await Promise.all([
    fetchInvestingBreadthOhlc(INVESTING_BREADTH_SOURCES.above50d),
    fetchInvestingBreadthOhlc(INVESTING_BREADTH_SOURCES.above200d),
    fetchYahooScreenerTotal(YAHOO_52_WEEK_SOURCES.highs.scrId),
    fetchYahooScreenerTotal(YAHOO_52_WEEK_SOURCES.lows.scrId)
  ]);
  return createMarketBreadthSnapshot({ above50d, above200d, highs52w, lows52w, sourceUpdatedAt: null, movingAverageSource: "Investing.com financialdata latest close", highLowSource: "Yahoo Finance predefined screeners (reported total; universe not verified as S&P 500-only)" });
}

function toDb(snapshot: MarketBreadthSnapshot) {
  validateMarketBreadth(snapshot);
  return { id: snapshot.id, above_50d_percent: snapshot.above50d.close, above_200d_percent: snapshot.above200d.close, above_50d_timestamp: snapshot.above50d.timestamp, above_50d_open: snapshot.above50d.open, above_50d_high: snapshot.above50d.high, above_50d_low: snapshot.above50d.low, above_50d_close: snapshot.above50d.close, above_200d_timestamp: snapshot.above200d.timestamp, above_200d_open: snapshot.above200d.open, above_200d_high: snapshot.above200d.high, above_200d_low: snapshot.above200d.low, above_200d_close: snapshot.above200d.close, highs_52w: snapshot.highs52w, lows_52w: snapshot.lows52w, source_url: snapshot.sourceUrl, source_updated_at: snapshot.sourceUpdatedAt, moving_average_source: snapshot.movingAverageSource, high_low_source: snapshot.highLowSource, fetched_at: snapshot.fetchedAt, content_hash: snapshot.contentHash, updated_at: new Date().toISOString() };
}

function fromDb(row: Rec): MarketBreadthSnapshot | null {
  const above50d = { timestamp: Number(row.above_50d_timestamp ?? 0), open: Number(row.above_50d_open ?? row.above_50d_percent), high: Number(row.above_50d_high ?? row.above_50d_percent), low: Number(row.above_50d_low ?? row.above_50d_percent), close: Number(row.above_50d_close ?? row.above_50d_percent) };
  const above200d = { timestamp: Number(row.above_200d_timestamp ?? 0), open: Number(row.above_200d_open ?? row.above_200d_percent), high: Number(row.above_200d_high ?? row.above_200d_percent), low: Number(row.above_200d_low ?? row.above_200d_percent), close: Number(row.above_200d_close ?? row.above_200d_percent) };
  const parsed = { above50d, above200d, highs52w: Number(row.highs_52w), lows52w: Number(row.lows_52w), sourceUpdatedAt: typeof row.source_updated_at === "string" ? row.source_updated_at : null, movingAverageSource: typeof row.moving_average_source === "string" ? row.moving_average_source : "Investing.com financialdata latest close", highLowSource: typeof row.high_low_source === "string" ? row.high_low_source : "Yahoo Finance predefined screeners" };
  try { validateMarketBreadth(parsed); } catch { return null; }
  const sourceUrl = typeof row.source_url === "string" ? row.source_url : MARKET_BREADTH_SOURCE_URL;
  return { id: "sp500", ...parsed, sourceUrl, fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : new Date().toISOString(), contentHash: typeof row.content_hash === "string" ? row.content_hash : stableHash({ ...parsed, sourceUrl }) };
}

export async function writeMarketBreadthSnapshot(client: SupabaseClient, snapshot: MarketBreadthSnapshot) {
  const { error } = await client.from(TABLE).upsert(toDb(snapshot), { onConflict: "id" });
  if (error) throw error;
}

export async function refreshMarketBreadth() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message, persisted: false });
  try {
    const snapshot = await buildMarketBreadthSnapshot();
    await writeMarketBreadthSnapshot(supabase.client, snapshot);
    const meta = { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, movingAverageSource: snapshot.movingAverageSource, highLowSource: snapshot.highLowSource, method: "investing-financialdata-latest-timestamp-ohlc + yahoo-screener-total", table: TABLE };
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: 1, contentHash: payloadContentHash([snapshot]), meta });
    return sourceResult({ ok: true, count: 1, changed: true, contentHash: snapshot.contentHash, upserted: 1, persisted: true, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Market Breadth refresh error";
    try { await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: false, rowCount: 0, error: message, meta: { preservedCache: true, table: TABLE } }); } catch {}
    return sourceResult({ ok: false, count: 0, error: message, persisted: false, meta: { preservedCache: true, table: TABLE } });
  }
}

export async function readCachedSp500Breadth(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return { snapshot: null, message: supabase.message };
  const select = "above_50d_percent,above_200d_percent,above_50d_timestamp,above_50d_open,above_50d_high,above_50d_low,above_50d_close,above_200d_timestamp,above_200d_open,above_200d_high,above_200d_low,above_200d_close,highs_52w,lows_52w,source_url,source_updated_at,moving_average_source,high_low_source,fetched_at,content_hash";
  const { data, error } = await supabase.client.from(TABLE).select(select).eq("id", "sp500").maybeSingle();
  if (error) return { snapshot: null, message: error.message };
  return { snapshot: isRec(data) ? fromDb(data) : null };
}

export function marketBreadthMetrics(snapshot: MarketBreadthSnapshot | null): Metric[] {
  const unavailable = { value: "—", subtext: "Market breadth cache unavailable", tone: "neutral" as const };
  return [
    { label: "% Above 50D MA", ...(snapshot ? { value: `${snapshot.above50d.close.toFixed(1)}%`, subtext: snapshot.movingAverageSource, tone: "neutral" as const } : unavailable) },
    { label: "% Above 200D MA", ...(snapshot ? { value: `${snapshot.above200d.close.toFixed(1)}%`, subtext: snapshot.movingAverageSource, tone: "neutral" as const } : unavailable) },
    { label: "52W Highs and Lows", ...(snapshot ? { value: `${snapshot.highs52w.toLocaleString()} / ${snapshot.lows52w.toLocaleString()}`, subtext: snapshot.highLowSource, tone: snapshot.highs52w >= snapshot.lows52w ? "positive" as const : "negative" as const } : unavailable) }
  ];
}
