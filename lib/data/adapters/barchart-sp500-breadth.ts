import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const BARCHART_SP500_URL = "https://www.barchart.com/stocks/indices/sp/sp500";
const TABLE = "barchart_market_breadth";
const SOURCE = "barchart_sp500_breadth";
const FETCH_TIMEOUT_MS = 15_000;

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePercent(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function parseCount(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/(-?\d[\d,]*)/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function sectionAfter(html: string, title: string, maxLength = 35_000) {
  const index = normalizeText(html).indexOf(normalizeText(title));
  if (index < 0) return null;
  // Use the raw substring from a raw lowercase search where possible; clean parsing below tolerates extra prefix.
  const rawIndex = html.toLowerCase().indexOf(title.toLowerCase().slice(0, 20));
  const start = rawIndex >= 0 ? rawIndex : Math.max(0, index - 2000);
  return html.slice(start, start + maxLength);
}

function parseMovingAveragePercent(section: string, day: 50 | 200) {
  const text = cleanText(section).replace(/[‐‑‒–—]/g, "-");
  const labelPattern = `${day}\\s*-?\\s*day\\s+average`;
  const afterLabel = text.match(new RegExp(`${labelPattern}[^%]{0,240}?(-?\\d+(?:\\.\\d+)?)\\s*%`, "i"));
  if (afterLabel) return parsePercent(`${afterLabel[1]}%`);
  const beforeLabel = text.match(new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*%[^%]{0,240}?${labelPattern}`, "i"));
  return parsePercent(beforeLabel?.[0]);
}

function tableRows(tableHtml: string) {
  return [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((row) => [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanText(cell[1])))
    .filter((row) => row.length);
}

function parse52WeekHighLow(section: string) {
  const tables = [...section.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  for (const table of tables) {
    const rows = tableRows(table);
    const header = rows.find((row) => row.some((cell) => /52\s*-?\s*week/i.test(cell)));
    const columnIndex = header?.findIndex((cell) => /52\s*-?\s*week/i.test(cell)) ?? -1;
    if (columnIndex < 0) continue;
    const highRow = rows.find((row) => /today'?s\s+new\s+highs/i.test(row[0] ?? ""));
    const lowRow = rows.find((row) => /today'?s\s+new\s+lows/i.test(row[0] ?? ""));
    const highs = parseCount(highRow?.[columnIndex]);
    const lows = parseCount(lowRow?.[columnIndex]);
    if (highs != null && lows != null) return { highs52w: highs, lows52w: lows };
  }

  const text = cleanText(section).replace(/[‐‑‒–—]/g, "-");
  const compact = text.match(/\(\d+\s+Total Components\)\s+(.+?)\s+Today's New Highs \(% of total\)\s+(.+?)\s+Today's New Lows \(% of total\)\s+(.+?)\s+Difference/i);
  if (!compact) throw new Error("Barchart 52-week highs/lows table rows not found.");
  const columns = compact[1].match(/5-Day|1-Month|3-Month|6-Month|52-Week|Year-to-Date/gi) ?? [];
  const columnIndex = columns.findIndex((column) => /52\s*-?\s*week/i.test(column));
  if (columnIndex < 0) throw new Error("Barchart 52-week highs/lows table is missing the 52-Week column.");
  const cellPattern = /\d[\d,]*\s*\([^)]*\)/g;
  const highCells = compact[2].match(cellPattern) ?? [];
  const lowCells = compact[3].match(cellPattern) ?? [];
  const highs = parseCount(highCells[columnIndex]);
  const lows = parseCount(lowCells[columnIndex]);
  return highs != null && lows != null ? { highs52w: highs, lows52w: lows } : null;
}

export function looksLikeBarchartBlockPage(html: string) {
  const text = normalizeText(html);
  return /captcha|cloudflare|access denied|temporarily blocked|verify you are human|checking your browser|akamai|datadome/.test(text);
}

export function validateBarchartBreadth(snapshot: ParsedBarchartBreadth) {
  if (!Number.isFinite(snapshot.above50dPercent) || snapshot.above50dPercent < 0 || snapshot.above50dPercent > 100) throw new Error("Barchart 50-day average percentage is outside 0-100.");
  if (!Number.isFinite(snapshot.above200dPercent) || snapshot.above200dPercent < 0 || snapshot.above200dPercent > 100) throw new Error("Barchart 200-day average percentage is outside 0-100.");
  if (!Number.isInteger(snapshot.highs52w) || snapshot.highs52w < 0) throw new Error("Barchart 52-week highs count is invalid.");
  if (!Number.isInteger(snapshot.lows52w) || snapshot.lows52w < 0) throw new Error("Barchart 52-week lows count is invalid.");
  const maxObserved = Math.max(snapshot.highs52w, snapshot.lows52w);
  if (maxObserved > 750) throw new Error("Barchart 52-week highs/lows count is unreasonable for S&P 500 components.");
}

export function parseBarchartSp500Breadth(html: string, fetchedAt = new Date().toISOString()): Sp500BreadthSnapshot {
  if (looksLikeBarchartBlockPage(html)) throw new Error("Barchart response appears to be a block/challenge page.");
  const maSection = sectionAfter(html, "Percentage of S&P 500 Stocks Above Moving Average");
  if (!maSection) throw new Error("Barchart moving-average breadth section not found.");
  const above50dPercent = parseMovingAveragePercent(maSection, 50);
  const above200dPercent = parseMovingAveragePercent(maSection, 200);
  if (above50dPercent == null) throw new Error("Barchart 50-day average percentage not found or invalid.");
  if (above200dPercent == null) throw new Error("Barchart 200-day average percentage not found or invalid.");

  const highLowSection = sectionAfter(html, "Summary of S&P 500 Stocks With New Highs and Lows");
  if (!highLowSection) throw new Error("Barchart highs/lows summary table not found.");
  const highLow = parse52WeekHighLow(highLowSection);
  if (!highLow) throw new Error("Barchart 52-week highs/lows values not found or invalid.");

  const parsed = { above50dPercent, above200dPercent, ...highLow, sourceUpdatedAt: null };
  validateBarchartBreadth(parsed);
  const values = { ...parsed, sourceUrl: BARCHART_SP500_URL };
  return { id: "sp500", ...values, fetchedAt, contentHash: stableHash(values) };
}

export async function fetchBarchartSp500Breadth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(BARCHART_SP500_URL, { cache: "no-store", headers: BROWSER_HEADERS, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`Barchart S&P 500 breadth fetch timed out after ${FETCH_TIMEOUT_MS}ms.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const contentType = response.headers.get("content-type") ?? "unknown";
  const html = await response.text();
  const diagnostic = { status: response.status, contentType, finalUrl: response.url, length: html.length, hasMovingAverageHeading: /Percentage of S&P 500 Stocks Above Moving Average/i.test(html), hasHighLowHeading: /Summary of S&P 500 Stocks With New Highs and Lows/i.test(html), has50DayLabel: /50\s*[-‐‑‒–—]?\s*DAY\s+AVERAGE/i.test(html) };
  if (!response.ok) throw new Error(`Barchart S&P 500 breadth fetch failed: ${JSON.stringify(diagnostic)}`);
  if (!/html/i.test(contentType)) throw new Error(`Barchart S&P 500 breadth fetch returned unexpected content type: ${JSON.stringify(diagnostic)}`);
  if (looksLikeBarchartBlockPage(html)) throw new Error(`Barchart S&P 500 breadth fetch returned a block/challenge page: ${JSON.stringify(diagnostic)}`);
  if (!diagnostic.hasMovingAverageHeading || !diagnostic.hasHighLowHeading) throw new Error(`Barchart S&P 500 breadth response missing expected page sections: ${JSON.stringify(diagnostic)}`);
  return parseBarchartSp500Breadth(html);
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
  const sourceUrl = typeof row.source_url === "string" ? row.source_url : BARCHART_SP500_URL;
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
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: 1, contentHash: payloadContentHash([snapshot]), meta: { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, sourceUpdatedAt: snapshot.sourceUpdatedAt } });
    return sourceResult({ ok: true, count: 1, changed: true, contentHash: snapshot.contentHash, upserted: 1, persisted: true, meta: { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, sourceUpdatedAt: snapshot.sourceUpdatedAt } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Barchart S&P 500 breadth refresh error";
    try { await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: false, rowCount: 0, error: message }); } catch {}
    return sourceResult({ ok: false, count: 0, error: message, persisted: false, meta: { preservedCache: true } });
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
    { label: "% Above 50D MA", ...(snapshot ? { value: `${snapshot.above50dPercent.toFixed(1)}%`, subtext: "Barchart 50-day average", tone: "neutral" as const } : unavailable) },
    { label: "% Above 200D MA", ...(snapshot ? { value: `${snapshot.above200dPercent.toFixed(1)}%`, subtext: "Barchart 200-day average", tone: "neutral" as const } : unavailable) },
    { label: "52W Highs and Lows", ...(snapshot ? { value: `${snapshot.highs52w.toLocaleString()} / ${snapshot.lows52w.toLocaleString()}`, subtext: "Barchart 52-week highs / lows", tone: snapshot.highs52w >= snapshot.lows52w ? "positive" as const : "negative" as const } : unavailable) }
  ];
}
