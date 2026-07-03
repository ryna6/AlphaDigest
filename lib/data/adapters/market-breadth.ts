import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { readCachedSp500HeatmapRows, type Sp500HeatmapRow } from "./unusual-whales-sp500-heatmap";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

const TABLE = "market_breadth";
const SOURCE = "market_breadth";
const FETCH_TIMEOUT_MS = 15_000;
const YAHOO_PAGE_SIZE = 100;
const MAX_YAHOO_PAGES = 20;

export const INVESTING_BREADTH_SOURCES = {
  above50d: { metric: "% Above 50D MA", name: "S&P 500 Stocks Above 50 Day Average", url: "https://ca.investing.com/indices/s-p-500-stocks-above-50-day-average" },
  above200d: { metric: "% Above 200D MA", name: "S&P 500 Stocks Above 200 Day Average", url: "https://ca.investing.com/indices/sp-500-stocks-above-200-day-average-chart" }
} as const;

export const YAHOO_52_WEEK_SOURCES = {
  highs: { metric: "52W Highs", scrId: "recent_52_week_highs", url: "https://ca.finance.yahoo.com/research-hub/screener/recent_52_week_highs/" },
  lows: { metric: "52W Lows", scrId: "recent_52_week_lows", url: "https://ca.finance.yahoo.com/research-hub/screener/recent_52_week_lows/" }
} as const;

export const MARKET_BREADTH_SOURCE_URL = [...Object.values(INVESTING_BREADTH_SOURCES), ...Object.values(YAHOO_52_WEEK_SOURCES)].map((source) => source.url).join(",");

const BASE_HEADERS = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "accept-language": "en-CA,en-US;q=0.9,en;q=0.8",
  "cache-control": "no-cache"
} as const;

const INVESTING_HEADERS = { ...BASE_HEADERS, referer: "https://ca.investing.com/indices/" } as const;
const YAHOO_HEADERS = { ...BASE_HEADERS, referer: "https://ca.finance.yahoo.com/research-hub/screener/" } as const;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

export type ParsedMarketBreadth = {
  above50dPercent: number;
  above200dPercent: number;
  highs52w: number;
  lows52w: number;
  sourceUpdatedAt: string | null;
  movingAverageSource: string;
  highLowSource: string;
};

export type MarketBreadthSnapshot = ParsedMarketBreadth & {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
};

export type ProviderDiagnostics = {
  url: string;
  status?: number;
  contentType?: string;
  finalUrl?: string;
  responseLength?: number;
  expectedNamePresent?: boolean;
  hasNumericCurrentValue?: boolean;
  appearsConsent?: boolean;
  appearsBlocked?: boolean;
  method: string;
};

function decodeHtml(value: string) {
  return value.replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function cleanText(value: string) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function normalizedText(value: string) {
  return cleanText(value).toLowerCase().replace(/[‐‑‒–—]/g, "-");
}

function parseStrictNumber(value: string) {
  const text = cleanText(value).replace(/[%,$,]/g, "");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function looksLikeProviderBlockPage(html: string) {
  const text = normalizedText(html);
  return /captcha|cloudflare|access denied|temporarily blocked|verify you are human|checking your browser|akamai|datadome|unusual traffic|enable javascript and cookies/.test(text);
}

function looksLikeConsentPage(html: string) {
  const text = normalizedText(html);
  return /consent|privacy choices|accept cookies|reject all|manage privacy/.test(text) && !/quote|regularmarketprice|s&p 500 stocks above/.test(text);
}

function identityPresent(html: string, expectedName: string) {
  const text = normalizedText(html);
  return expectedName.toLowerCase().split(/\s+/).filter((part) => part.length > 2).every((part) => text.includes(part));
}

function extractJsonObjects(html: string) {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(decodeHtml(match[1].trim()))); } catch {}
  }
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?(?:last_price|lastPrice|regularMarketPrice|instrument|quote)[\s\S]*?)<\/script>/gi)) {
    const body = match[1];
    for (const jsonMatch of body.matchAll(/\{[\s\S]{20,5000}?\}/g)) {
      try { values.push(JSON.parse(jsonMatch[0])); } catch {}
    }
  }
  return values;
}

function findCurrentValueInJson(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findCurrentValueInJson(item); if (found != null) return found; }
    return null;
  }
  if (!isRec(value)) return null;
  for (const key of ["last_price", "lastPrice", "price", "last", "value", "regularMarketPrice"]) {
    const raw = value[key];
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? parseStrictNumber(raw) : null;
    if (parsed != null && parsed >= 0 && parsed <= 100) return parsed;
  }
  for (const nested of Object.values(value)) { const found = findCurrentValueInJson(nested); if (found != null) return found; }
  return null;
}

export function diagnoseInvestingHtml(html: string, url: string, expectedName: string, response?: Response): ProviderDiagnostics {
  return { url, status: response?.status, contentType: response?.headers.get("content-type") ?? undefined, finalUrl: response?.url, responseLength: html.length, expectedNamePresent: identityPresent(html, expectedName), hasNumericCurrentValue: parseInvestingCurrentValue(html, expectedName, false) != null, appearsConsent: looksLikeConsentPage(html), appearsBlocked: looksLikeProviderBlockPage(html), method: "investing-html-or-embedded-json" };
}

export function parseInvestingCurrentValue(html: string, expectedName: string, strict = true) {
  const diagnostic = strict ? diagnoseInvestingHtml(html, "fixture", expectedName) : null;
  if (strict) {
    if (diagnostic?.appearsBlocked) throw new Error(`Investing.com page appears to be a block/challenge page: ${JSON.stringify(diagnostic)}`);
    if (diagnostic?.appearsConsent) throw new Error(`Investing.com page appears to be a consent page: ${JSON.stringify(diagnostic)}`);
    if (!diagnostic?.expectedNamePresent) throw new Error(`Investing.com page does not match expected instrument: ${JSON.stringify(diagnostic)}`);
  }
  const jsonValue = findCurrentValueInJson(extractJsonObjects(html));
  if (jsonValue != null) return jsonValue;
  const titlePattern = new RegExp(`<h1[^>]*>[\\s\\S]*?${expectedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?<\\/h1>[\\s\\S]{0,2000}?<[^>]+(?:data-test=["']instrument-price-last["']|class=["'][^"']*(?:text-5xl|last|price)[^"']*["'])[^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
  const nearTitle = html.match(titlePattern)?.[1];
  const value = nearTitle ? parseStrictNumber(nearTitle) : null;
  if (value != null) return value;
  const text = cleanText(html);
  const nameIndex = text.toLowerCase().indexOf(expectedName.toLowerCase());
  const windowText = nameIndex >= 0 ? text.slice(nameIndex, nameIndex + 600) : text.slice(0, 1000);
  const numeric = windowText.match(/(?:^|\s)(\d{1,3}(?:\.\d+)?)(?!\s*%?\s*(?:\+|\-|change|open|high|low))/i)?.[1];
  const parsedCandidate = numeric ? parseStrictNumber(numeric) : null;
  const parsed = parsedCandidate != null && parsedCandidate >= 0 && parsedCandidate <= 100 ? parsedCandidate : null;
  if (strict && parsed == null) throw new Error(`Investing.com page is missing a numeric current value: ${JSON.stringify(diagnostic)}`);
  return parsed;
}

async function fetchTextWithTimeout(url: string, headers: HeadersInit, attempt = 1): Promise<{ text: string; response: Response }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", headers, signal: controller.signal, redirect: "follow" });
    return { text: await response.text(), response };
  } catch (error) {
    if (attempt < 2) return fetchTextWithTimeout(url, headers, attempt + 1);
    if (error instanceof Error && error.name === "AbortError") throw new Error(`Provider fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function fetchInvestingBreadthValue(source: typeof INVESTING_BREADTH_SOURCES[keyof typeof INVESTING_BREADTH_SOURCES]) {
  const { text, response } = await fetchTextWithTimeout(source.url, INVESTING_HEADERS);
  const diagnostic = diagnoseInvestingHtml(text, source.url, source.name, response);
  if (!response.ok || !/html/i.test(diagnostic.contentType ?? "") || diagnostic.appearsBlocked || diagnostic.appearsConsent) throw new Error(`Investing.com ${source.metric} fetch failed: ${JSON.stringify(diagnostic)}`);
  const value = parseInvestingCurrentValue(text, source.name);
  if (value == null || value < 0 || value > 100) throw new Error(`Investing.com ${source.metric} current value is missing or outside 0-100: ${JSON.stringify(diagnostic)}`);
  return value;
}

export function normalizeTicker(symbol: string) {
  return symbol.trim().toUpperCase().replace(/\s+/g, "").replace(/[.]/g, "-");
}

function extractYahooRows(json: unknown): Rec[] {
  if (Array.isArray(json)) return json.filter(isRec);
  if (!isRec(json)) return [];
  for (const key of ["quotes", "rows", "result", "results", "data"]) {
    const value = json[key];
    if (Array.isArray(value)) {
      if (key === "quotes") return value.filter(isRec);
      for (const item of value) { const rows = extractYahooRows(item); if (rows.length) return rows; }
      return value.filter(isRec);
    }
    if (isRec(value)) { const rows = extractYahooRows(value); if (rows.length) return rows; }
  }
  for (const value of Object.values(json)) { const rows = extractYahooRows(value); if (rows.length) return rows; }
  return [];
}

function yahooTotal(json: unknown): number | null {
  if (Array.isArray(json)) {
    for (const item of json) { const total = yahooTotal(item); if (total != null) return total; }
    return null;
  }
  if (!isRec(json)) return null;
  for (const key of ["total", "totalCount", "count"]) if (typeof json[key] === "number") return json[key] as number;
  for (const value of Object.values(json)) { const total = yahooTotal(value); if (total != null) return total; }
  return null;
}

export function parseYahooScreenerSymbols(json: unknown) {
  const symbols = new Set<string>();
  for (const row of extractYahooRows(json)) {
    const quoteType = String(row.quoteType ?? row.typeDisp ?? row.type ?? "EQUITY").toUpperCase();
    if (quoteType && !quoteType.includes("EQUITY")) continue;
    const symbol = typeof row.symbol === "string" ? row.symbol : null;
    if (symbol) symbols.add(normalizeTicker(symbol));
  }
  return { symbols, total: yahooTotal(json) };
}

async function fetchYahooScreenerPage(scrId: string, start: number) {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${encodeURIComponent(scrId)}&count=${YAHOO_PAGE_SIZE}&start=${start}`;
  const response = await fetch(url, { cache: "no-store", headers: { ...YAHOO_HEADERS, accept: "application/json,text/plain,*/*" }, redirect: "follow" });
  const text = await response.text();
  const diagnostic: ProviderDiagnostics = { url, status: response.status, contentType: response.headers.get("content-type") ?? undefined, finalUrl: response.url, responseLength: text.length, appearsConsent: looksLikeConsentPage(text), appearsBlocked: looksLikeProviderBlockPage(text), method: "yahoo-screener-api" };
  if (!response.ok || diagnostic.appearsBlocked || diagnostic.appearsConsent) throw new Error(`Yahoo Finance screener fetch failed: ${JSON.stringify(diagnostic)}`);
  try { return { json: JSON.parse(text), diagnostic }; } catch { throw new Error(`Yahoo Finance screener returned malformed JSON: ${JSON.stringify(diagnostic)}`); }
}

export async function fetchYahoo52WeekSymbols(scrId: string) {
  const all = new Set<string>();
  let total: number | null = null;
  for (let start = 0, page = 0; page < MAX_YAHOO_PAGES; page += 1, start += YAHOO_PAGE_SIZE) {
    const { json } = await fetchYahooScreenerPage(scrId, start);
    const parsed = parseYahooScreenerSymbols(json);
    parsed.symbols.forEach((symbol) => all.add(symbol));
    total = parsed.total ?? total;
    if (parsed.symbols.size < YAHOO_PAGE_SIZE || (total != null && start + YAHOO_PAGE_SIZE >= total)) break;
  }
  return all;
}

export function intersectWithSp500(symbols: Set<string>, sp500Rows: Pick<Sp500HeatmapRow, "ticker">[]) {
  const sp500 = new Set(sp500Rows.map((row) => normalizeTicker(row.ticker)));
  return [...symbols].filter((symbol) => sp500.has(normalizeTicker(symbol)));
}

export function validateMarketBreadth(snapshot: ParsedMarketBreadth) {
  if (!Number.isFinite(snapshot.above50dPercent) || snapshot.above50dPercent < 0 || snapshot.above50dPercent > 100) throw new Error("Market breadth 50-day average percentage is outside 0-100.");
  if (!Number.isFinite(snapshot.above200dPercent) || snapshot.above200dPercent < 0 || snapshot.above200dPercent > 100) throw new Error("Market breadth 200-day average percentage is outside 0-100.");
  if (!Number.isInteger(snapshot.highs52w) || snapshot.highs52w < 0) throw new Error("Market breadth 52-week highs count is invalid.");
  if (!Number.isInteger(snapshot.lows52w) || snapshot.lows52w < 0) throw new Error("Market breadth 52-week lows count is invalid.");
  if (Math.max(snapshot.highs52w, snapshot.lows52w) > 750) throw new Error("Market breadth 52-week highs/lows count is unreasonable for S&P 500 components.");
}

export function createMarketBreadthSnapshot(values: ParsedMarketBreadth, fetchedAt = new Date().toISOString()): MarketBreadthSnapshot {
  validateMarketBreadth(values);
  const sourceUrl = MARKET_BREADTH_SOURCE_URL;
  return { id: "sp500", ...values, sourceUrl, fetchedAt, contentHash: stableHash({ ...values, sourceUrl }) };
}

export async function buildMarketBreadthSnapshot(sp500Rows: Pick<Sp500HeatmapRow, "ticker">[]) {
  if (!sp500Rows.length) throw new Error("Cannot build Market Breadth snapshot without cached S&P 500 constituents.");
  const [above50dPercent, above200dPercent, highSymbols, lowSymbols] = await Promise.all([
    fetchInvestingBreadthValue(INVESTING_BREADTH_SOURCES.above50d),
    fetchInvestingBreadthValue(INVESTING_BREADTH_SOURCES.above200d),
    fetchYahoo52WeekSymbols(YAHOO_52_WEEK_SOURCES.highs.scrId),
    fetchYahoo52WeekSymbols(YAHOO_52_WEEK_SOURCES.lows.scrId)
  ]);
  const uniqueSpxHighSymbols = intersectWithSp500(highSymbols, sp500Rows);
  const uniqueSpxLowSymbols = intersectWithSp500(lowSymbols, sp500Rows);
  return createMarketBreadthSnapshot({ above50dPercent, above200dPercent, highs52w: uniqueSpxHighSymbols.length, lows52w: uniqueSpxLowSymbols.length, sourceUpdatedAt: null, movingAverageSource: "Investing.com", highLowSource: "Yahoo Finance filtered to cached S&P 500 constituents" });
}

function toDb(snapshot: MarketBreadthSnapshot) {
  validateMarketBreadth(snapshot);
  return { id: snapshot.id, above_50d_percent: snapshot.above50dPercent, above_200d_percent: snapshot.above200dPercent, highs_52w: snapshot.highs52w, lows_52w: snapshot.lows52w, source_url: snapshot.sourceUrl, source_updated_at: snapshot.sourceUpdatedAt, moving_average_source: snapshot.movingAverageSource, high_low_source: snapshot.highLowSource, fetched_at: snapshot.fetchedAt, content_hash: snapshot.contentHash, updated_at: new Date().toISOString() };
}

function fromDb(row: Rec): MarketBreadthSnapshot | null {
  const parsed = { above50dPercent: Number(row.above_50d_percent), above200dPercent: Number(row.above_200d_percent), highs52w: Number(row.highs_52w), lows52w: Number(row.lows_52w), sourceUpdatedAt: typeof row.source_updated_at === "string" ? row.source_updated_at : null, movingAverageSource: typeof row.moving_average_source === "string" ? row.moving_average_source : "Investing.com", highLowSource: typeof row.high_low_source === "string" ? row.high_low_source : "Yahoo Finance filtered to S&P 500 constituents" };
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
    const { rows } = await readCachedSp500HeatmapRows(supabase.client);
    const snapshot = await buildMarketBreadthSnapshot(rows);
    await writeMarketBreadthSnapshot(supabase.client, snapshot);
    const meta = { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, sourceUpdatedAt: snapshot.sourceUpdatedAt, movingAverageSource: snapshot.movingAverageSource, highLowSource: snapshot.highLowSource, method: "investing-html-or-embedded-json + yahoo-screener-api", table: TABLE };
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
  const { data, error } = await supabase.client.from(TABLE).select("above_50d_percent,above_200d_percent,highs_52w,lows_52w,source_url,source_updated_at,moving_average_source,high_low_source,fetched_at,content_hash").eq("id", "sp500").maybeSingle();
  if (error) return { snapshot: null, message: error.message };
  return { snapshot: isRec(data) ? fromDb(data) : null };
}

export function marketBreadthMetrics(snapshot: MarketBreadthSnapshot | null): Metric[] {
  const unavailable = { value: "—", subtext: "Market breadth cache unavailable", tone: "neutral" as const };
  return [
    { label: "% Above 50D MA", ...(snapshot ? { value: `${snapshot.above50dPercent.toFixed(1)}%`, subtext: snapshot.movingAverageSource, tone: "neutral" as const } : unavailable) },
    { label: "% Above 200D MA", ...(snapshot ? { value: `${snapshot.above200dPercent.toFixed(1)}%`, subtext: snapshot.movingAverageSource, tone: "neutral" as const } : unavailable) },
    { label: "52W Highs and Lows", ...(snapshot ? { value: `${snapshot.highs52w.toLocaleString()} / ${snapshot.lows52w.toLocaleString()}`, subtext: snapshot.highLowSource, tone: snapshot.highs52w >= snapshot.lows52w ? "positive" as const : "negative" as const } : unavailable) }
  ];
}
