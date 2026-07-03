import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

const TABLE = "barchart_market_breadth";
const SOURCE = "barchart_sp500_breadth";
const FETCH_TIMEOUT_MS = 15_000;

export const BARCHART_QUOTE_SOURCES = {
  MMFI: { symbol: "$MMFI", metric: "% Above 50D MA", url: "https://www.barchart.com/stocks/quotes/$MMFI" },
  MMTH: { symbol: "$MMTH", metric: "% Above 200D MA", url: "https://www.barchart.com/stocks/quotes/$MMTH" },
  MAHP: { symbol: "$MAHP", metric: "52W Highs", url: "https://www.barchart.com/stocks/quotes/$MAHP" },
  MALP: { symbol: "$MALP", metric: "52W Lows", url: "https://www.barchart.com/stocks/quotes/$MALP" }
} as const;

export const BARCHART_BREADTH_SOURCE_URL = Object.values(BARCHART_QUOTE_SOURCES).map((source) => source.url).join(",");
export const BARCHART_LAST_PRICE_SELECTOR = `.pricechangerow > span.last-change[data-ng-class*="lastPrice"]`;

const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  referer: "https://www.barchart.com/",
  "cache-control": "no-cache"
} as const;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

export type ParsedBarchartBreadth = {
  above50dPercent: number;
  above200dPercent: number;
  highs52w: number;
  lows52w: number;
  sourceUpdatedAt: string | null;
};

export type Sp500BreadthSnapshot = ParsedBarchartBreadth & {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
};

export type BarchartQuoteDiagnostics = {
  url: string;
  symbol: string;
  status?: number;
  contentType?: string;
  finalUrl?: string;
  responseLength?: number;
  hasPriceChangeRow?: boolean;
  hasLastPriceSpan?: boolean;
  hasNumericLastPrice?: boolean;
  appearsBlocked?: boolean;
  method: "quote-page-html";
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function cleanText(value: string) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return cleanText(value).toLowerCase().replace(/[‐‑‒–—]/g, "-").replace(/\s+/g, " ").trim();
}


export function looksLikeBarchartBlockPage(html: string) {
  const text = normalizeText(html);
  return /captcha|cloudflare|access denied|temporarily blocked|verify you are human|checking your browser|akamai|datadome|enable javascript and cookies/.test(text);
}

function parseStrictNumber(value: string) {
  const text = cleanText(value).replace(/,/g, "");
  if (!text || !/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function findPriceChangeRow(html: string) {
  return html.match(/<div\b(?=[^>]*class=["'][^"']*\bpricechangerow\b[^"']*["'])[^>]*>[\s\S]*?<\/div>/i)?.[0] ?? null;
}

function findDirectLastPriceSpan(rowHtml: string) {
  const spanPattern = /<span\b(?=[^>]*class=["'][^"']*\blast-change\b[^"']*["'])(?=[^>]*data-ng-class=[^>]*lastPrice)[^>]*>([\s\S]*?)<\/span>/i;
  const match = rowHtml.match(spanPattern);
  return match ? { html: match[0], text: cleanText(match[1]) } : null;
}

export function diagnoseBarchartQuoteHtml(html: string, url: string, symbol: string, response?: Response): BarchartQuoteDiagnostics {
  const row = findPriceChangeRow(html);
  const lastPrice = row ? findDirectLastPriceSpan(row) : null;
  return {
    url,
    symbol,
    status: response?.status,
    contentType: response?.headers.get("content-type") ?? undefined,
    finalUrl: response?.url,
    responseLength: html.length,
    hasPriceChangeRow: !!row,
    hasLastPriceSpan: !!lastPrice,
    hasNumericLastPrice: lastPrice ? parseStrictNumber(lastPrice.text) != null : false,
    appearsBlocked: looksLikeBarchartBlockPage(html),
    method: "quote-page-html"
  };
}

export function parseBarchartQuoteValueHtml(html: string, expectedSymbol: string, url = `https://www.barchart.com/stocks/quotes/${expectedSymbol}`) {
  const diagnostic = diagnoseBarchartQuoteHtml(html, url, expectedSymbol);
  if (diagnostic.appearsBlocked) throw new Error(`Barchart ${expectedSymbol} quote page appears to be a block/challenge page: ${JSON.stringify(diagnostic)}`);
  const row = findPriceChangeRow(html);
  if (!row) throw new Error(`Barchart ${expectedSymbol} quote page is missing .pricechangerow: ${JSON.stringify(diagnostic)}`);
  const lastPrice = findDirectLastPriceSpan(row);
  if (!lastPrice) throw new Error(`Barchart ${expectedSymbol} quote page is missing ${BARCHART_LAST_PRICE_SELECTOR}: ${JSON.stringify(diagnostic)}`);
  const value = parseStrictNumber(lastPrice.text);
  if (value == null) throw new Error(`Barchart ${expectedSymbol} quote page lastPrice is not numeric: ${JSON.stringify(diagnostic)}`);
  return value;
}

async function fetchWithTimeout(url: string, expectedSymbol: string, attempt = 1): Promise<{ html: string; response: Response }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", headers: BROWSER_HEADERS, signal: controller.signal });
    const html = await response.text();
    return { html, response };
  } catch (error) {
    if (attempt < 2) return fetchWithTimeout(url, expectedSymbol, attempt + 1);
    if (error instanceof Error && error.name === "AbortError") throw new Error(`Barchart ${expectedSymbol} quote fetch timed out after ${FETCH_TIMEOUT_MS}ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBarchartQuoteValue(url: string, expectedSymbol: string): Promise<number> {
  const { html, response } = await fetchWithTimeout(url, expectedSymbol);
  const diagnostic = diagnoseBarchartQuoteHtml(html, url, expectedSymbol, response);
  if (!response.ok) throw new Error(`Barchart ${expectedSymbol} quote fetch failed: ${JSON.stringify(diagnostic)}`);
  if (!/html/i.test(diagnostic.contentType ?? "")) throw new Error(`Barchart ${expectedSymbol} quote fetch returned unexpected content type: ${JSON.stringify(diagnostic)}`);
  if (diagnostic.appearsBlocked) throw new Error(`Barchart ${expectedSymbol} quote fetch returned a block/challenge page: ${JSON.stringify(diagnostic)}`);
  return parseBarchartQuoteValueHtml(html, expectedSymbol, url);
}

export function validateBarchartBreadth(snapshot: ParsedBarchartBreadth) {
  if (!Number.isFinite(snapshot.above50dPercent) || snapshot.above50dPercent < 0 || snapshot.above50dPercent > 100) throw new Error("Barchart 50-day average percentage is outside 0-100.");
  if (!Number.isFinite(snapshot.above200dPercent) || snapshot.above200dPercent < 0 || snapshot.above200dPercent > 100) throw new Error("Barchart 200-day average percentage is outside 0-100.");
  if (!Number.isInteger(snapshot.highs52w) || snapshot.highs52w < 0) throw new Error("Barchart 52-week highs count is invalid.");
  if (!Number.isInteger(snapshot.lows52w) || snapshot.lows52w < 0) throw new Error("Barchart 52-week lows count is invalid.");
  const maxObserved = Math.max(snapshot.highs52w, snapshot.lows52w);
  if (maxObserved > 750) throw new Error("Barchart 52-week highs/lows count is unreasonable for S&P 500 components.");
}

export function createBarchartSp500BreadthSnapshot(values: ParsedBarchartBreadth, fetchedAt = new Date().toISOString()): Sp500BreadthSnapshot {
  validateBarchartBreadth(values);
  const sourceUrl = BARCHART_BREADTH_SOURCE_URL;
  const hashValues = { ...values, sourceUrl };
  return { id: "sp500", ...values, sourceUrl, fetchedAt, contentHash: stableHash(hashValues) };
}

export async function fetchBarchartSp500Breadth() {
  const [above50dPercent, above200dPercent, highs52w, lows52w] = await Promise.all([
    fetchBarchartQuoteValue(BARCHART_QUOTE_SOURCES.MMFI.url, BARCHART_QUOTE_SOURCES.MMFI.symbol),
    fetchBarchartQuoteValue(BARCHART_QUOTE_SOURCES.MMTH.url, BARCHART_QUOTE_SOURCES.MMTH.symbol),
    fetchBarchartQuoteValue(BARCHART_QUOTE_SOURCES.MAHP.url, BARCHART_QUOTE_SOURCES.MAHP.symbol),
    fetchBarchartQuoteValue(BARCHART_QUOTE_SOURCES.MALP.url, BARCHART_QUOTE_SOURCES.MALP.symbol)
  ]);
  return createBarchartSp500BreadthSnapshot({ above50dPercent, above200dPercent, highs52w, lows52w, sourceUpdatedAt: null });
}

function toDb(snapshot: Sp500BreadthSnapshot) {
  validateBarchartBreadth(snapshot);
  return {
    id: snapshot.id,
    above_50d_percent: snapshot.above50dPercent,
    above_200d_percent: snapshot.above200dPercent,
    highs_52w: snapshot.highs52w,
    lows_52w: snapshot.lows52w,
    source_url: snapshot.sourceUrl,
    source_updated_at: snapshot.sourceUpdatedAt,
    fetched_at: snapshot.fetchedAt,
    content_hash: snapshot.contentHash,
    updated_at: new Date().toISOString()
  };
}

function fromDb(row: Rec): Sp500BreadthSnapshot | null {
  const above50dPercent = Number(row.above_50d_percent);
  const above200dPercent = Number(row.above_200d_percent);
  const highs52w = Number(row.highs_52w);
  const lows52w = Number(row.lows_52w);
  const fetchedAt = typeof row.fetched_at === "string" ? row.fetched_at : new Date().toISOString();
  const sourceUrl = typeof row.source_url === "string" ? row.source_url : BARCHART_BREADTH_SOURCE_URL;
  const sourceUpdatedAt = typeof row.source_updated_at === "string" ? row.source_updated_at : null;
  const parsed = { above50dPercent, above200dPercent, highs52w, lows52w, sourceUpdatedAt };
  try { validateBarchartBreadth(parsed); } catch { return null; }
  return { id: "sp500", ...parsed, sourceUrl, fetchedAt, contentHash: typeof row.content_hash === "string" ? row.content_hash : stableHash({ ...parsed, sourceUrl }) };
}

export async function writeBarchartSp500BreadthSnapshot(client: SupabaseClient, snapshot: Sp500BreadthSnapshot) {
  const { error } = await client.from(TABLE).upsert(toDb(snapshot), { onConflict: "id" });
  if (error) throw error;
}

export async function refreshBarchartSp500Breadth() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message, persisted: false });
  try {
    const snapshot = await fetchBarchartSp500Breadth();
    await writeBarchartSp500BreadthSnapshot(supabase.client, snapshot);
    const meta = { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, sourceUpdatedAt: snapshot.sourceUpdatedAt, method: "quote-page-html", selector: BARCHART_LAST_PRICE_SELECTOR, symbols: BARCHART_QUOTE_SOURCES };
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: 1, contentHash: payloadContentHash([snapshot]), meta });
    return sourceResult({ ok: true, count: 1, changed: true, contentHash: snapshot.contentHash, upserted: 1, persisted: true, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Barchart S&P 500 breadth refresh error";
    try { await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: false, rowCount: 0, error: message, meta: { preservedCache: true, method: "quote-page-html", selector: BARCHART_LAST_PRICE_SELECTOR } }); } catch {}
    return sourceResult({ ok: false, count: 0, error: message, persisted: false, meta: { preservedCache: true, method: "quote-page-html" } });
  }
}

export async function readCachedSp500Breadth(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return { snapshot: null, message: supabase.message };
  const { data, error } = await supabase.client.from(TABLE).select("above_50d_percent,above_200d_percent,highs_52w,lows_52w,source_url,source_updated_at,fetched_at,content_hash").eq("id", "sp500").maybeSingle();
  if (error) return { snapshot: null, message: error.message };
  return { snapshot: isRec(data) ? fromDb(data) : null };
}

export function barchartBreadthMetrics(snapshot: Sp500BreadthSnapshot | null): Metric[] {
  const unavailable = { value: "—", subtext: "Barchart cache unavailable", tone: "neutral" as const };
  return [
    { label: "% Above 50D MA", ...(snapshot ? { value: `${snapshot.above50dPercent.toFixed(1)}%`, subtext: "Barchart $MMFI", tone: "neutral" as const } : unavailable) },
    { label: "% Above 200D MA", ...(snapshot ? { value: `${snapshot.above200dPercent.toFixed(1)}%`, subtext: "Barchart $MMTH", tone: "neutral" as const } : unavailable) },
    { label: "52W Highs and Lows", ...(snapshot ? { value: `${snapshot.highs52w.toLocaleString()} / ${snapshot.lows52w.toLocaleString()}`, subtext: "Barchart $MAHP / $MALP", tone: snapshot.highs52w >= snapshot.lows52w ? "positive" as const : "negative" as const } : unavailable) }
  ];
}
