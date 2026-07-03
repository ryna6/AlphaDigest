import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const BARCHART_SP500_URL = "https://www.barchart.com/stocks/indices/sp/sp500";
const TABLE = "market_breadth_cache";
const SOURCE = "barchart_sp500_breadth";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

export type Sp500BreadthSnapshot = {
  id: string;
  above50dMa: number;
  above200dMa: number;
  highs52w: number;
  lows52w: number;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanText(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parsePercent(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*%?/);
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

function sectionAfter(html: string, title: string) {
  const index = html.toLowerCase().indexOf(title.toLowerCase());
  if (index < 0) return null;
  return html.slice(index, index + 20000);
}

function parseMovingAveragePercent(section: string, label: string) {
  const text = cleanText(section);
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  const afterLabel = text.match(new RegExp(`${labelPattern}[^%]{0,160}?(-?\\d+(?:\\.\\d+)?)\\s*%`, "i"));
  if (afterLabel) return parsePercent(afterLabel[1]);
  const beforeLabel = text.match(new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*%[^%]{0,160}?${labelPattern}`, "i"));
  return parsePercent(beforeLabel?.[1]);
}

function tableRows(tableHtml: string) {
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) => {
    return [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanText(cell[1]));
  });
  return rows.filter((row) => row.length);
}

function parse52WeekHighLow(section: string) {
  const tableMatch = section.match(/<table[\s\S]*?<\/table>/i);
  if (tableMatch) {
    const rows = tableRows(tableMatch[0]);
    const header = rows.find((row) => row.some((cell) => /52\s*-?\s*week/i.test(cell)));
    const columnIndex = header?.findIndex((cell) => /52\s*-?\s*week/i.test(cell)) ?? -1;
    if (columnIndex >= 0) {
      const highRow = rows.find((row) => row.some((cell) => /new\s+highs?|highs/i.test(cell)));
      const lowRow = rows.find((row) => row.some((cell) => /new\s+lows?|lows/i.test(cell)));
      const highs = parseCount(highRow?.[columnIndex]);
      const lows = parseCount(lowRow?.[columnIndex]);
      if (highs != null && lows != null) return { highs52w: highs, lows52w: lows };
    }
  }

  const text = cleanText(section);
  const highMatch = text.match(/52\s*-?\s*week[^\d]{0,120}(?:new\s+)?highs?[^\d]{0,80}(\d[\d,]*)/i) ?? text.match(/(?:new\s+)?highs?[^\d]{0,80}(\d[\d,]*)[^A-Za-z0-9]{0,120}52\s*-?\s*week/i);
  const lowMatch = text.match(/52\s*-?\s*week[\s\S]{0,260}?(?:new\s+)?lows?[^\d]{0,80}(\d[\d,]*)/i) ?? text.match(/(?:new\s+)?lows?[^\d]{0,80}(\d[\d,]*)[^A-Za-z0-9]{0,120}52\s*-?\s*week/i);
  const highs = parseCount(highMatch?.[1]);
  const lows = parseCount(lowMatch?.[1]);
  return highs != null && lows != null ? { highs52w: highs, lows52w: lows } : null;
}

export function parseBarchartSp500Breadth(html: string, fetchedAt = new Date().toISOString()): Sp500BreadthSnapshot {
  const maSection = sectionAfter(html, "Percentage of S&P 500 Stocks Above Moving Average");
  if (!maSection) throw new Error("Barchart moving-average breadth section not found.");
  const above50dMa = parseMovingAveragePercent(maSection, "50-day average");
  const above200dMa = parseMovingAveragePercent(maSection, "200-day average");
  if (above50dMa == null) throw new Error("Barchart 50-day average percentage not found or invalid.");
  if (above200dMa == null) throw new Error("Barchart 200-day average percentage not found or invalid.");

  const highLowSection = sectionAfter(html, "Summary of S&P 500 Stocks With New Highs and Lows");
  if (!highLowSection) throw new Error("Barchart highs/lows summary table not found.");
  const highLow = parse52WeekHighLow(highLowSection);
  if (!highLow) throw new Error("Barchart 52-week highs/lows values not found or invalid.");

  const values = { above50dMa, above200dMa, ...highLow, sourceUrl: BARCHART_SP500_URL };
  return { id: "sp500", ...values, fetchedAt, contentHash: stableHash(values) };
}

export async function fetchBarchartSp500Breadth() {
  const response = await fetch(BARCHART_SP500_URL, {
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Mozilla/5.0 (compatible; AlphaDigestBot/1.0; +https://alphadigest.app)"
    }
  });
  if (!response.ok) throw new Error(`Barchart S&P 500 breadth fetch failed: ${response.status}`);
  return parseBarchartSp500Breadth(await response.text());
}

function toDb(snapshot: Sp500BreadthSnapshot) {
  return {
    id: snapshot.id,
    above_50d_ma: snapshot.above50dMa,
    above_200d_ma: snapshot.above200dMa,
    highs_52w: snapshot.highs52w,
    lows_52w: snapshot.lows52w,
    source_url: snapshot.sourceUrl,
    fetched_at: snapshot.fetchedAt,
    content_hash: snapshot.contentHash,
    updated_at: new Date().toISOString()
  };
}

function fromDb(row: Rec): Sp500BreadthSnapshot | null {
  const above50dMa = typeof row.above_50d_ma === "number" ? row.above_50d_ma : Number(row.above_50d_ma);
  const above200dMa = typeof row.above_200d_ma === "number" ? row.above_200d_ma : Number(row.above_200d_ma);
  const highs52w = typeof row.highs_52w === "number" ? row.highs_52w : Number(row.highs_52w);
  const lows52w = typeof row.lows_52w === "number" ? row.lows_52w : Number(row.lows_52w);
  const fetchedAt = typeof row.fetched_at === "string" ? row.fetched_at : new Date().toISOString();
  const sourceUrl = typeof row.source_url === "string" ? row.source_url : BARCHART_SP500_URL;
  if (![above50dMa, above200dMa, highs52w, lows52w].every(Number.isFinite)) return null;
  return { id: "sp500", above50dMa, above200dMa, highs52w, lows52w, sourceUrl, fetchedAt, contentHash: typeof row.content_hash === "string" ? row.content_hash : stableHash({ above50dMa, above200dMa, highs52w, lows52w, sourceUrl }) };
}

export async function refreshBarchartSp500Breadth() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message, persisted: false });
  try {
    const snapshot = await fetchBarchartSp500Breadth();
    const { error } = await supabase.client.from(TABLE).upsert(toDb(snapshot), { onConflict: "id" });
    if (error) throw error;
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: 1, contentHash: payloadContentHash([snapshot]), meta: { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt } });
    return sourceResult({ ok: true, count: 1, changed: true, contentHash: snapshot.contentHash, upserted: 1, persisted: true, meta: { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Barchart S&P 500 breadth refresh error";
    try { await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: false, rowCount: 0, error: message }); } catch {}
    return sourceResult({ ok: false, count: 0, error: message, persisted: false });
  }
}

export async function readCachedSp500Breadth(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return { snapshot: null, message: supabase.message };
  const { data, error } = await supabase.client.from(TABLE).select("above_50d_ma,above_200d_ma,highs_52w,lows_52w,source_url,fetched_at,content_hash").eq("id", "sp500").maybeSingle();
  if (error) return { snapshot: null, message: error.message };
  return { snapshot: isRec(data) ? fromDb(data) : null };
}

export function barchartBreadthMetrics(snapshot: Sp500BreadthSnapshot | null): Metric[] {
  const unavailable = { value: "—", subtext: "Barchart cache unavailable", tone: "neutral" as const };
  return [
    { label: "% Above 50D MA", ...(snapshot ? { value: `${snapshot.above50dMa.toFixed(1)}%`, subtext: "Barchart 50-day average", tone: "neutral" as const } : unavailable) },
    { label: "% Above 200D MA", ...(snapshot ? { value: `${snapshot.above200dMa.toFixed(1)}%`, subtext: "Barchart 200-day average", tone: "neutral" as const } : unavailable) },
    { label: "52W Highs and Lows", ...(snapshot ? { value: `${snapshot.highs52w.toLocaleString()} / ${snapshot.lows52w.toLocaleString()}`, subtext: "Barchart 52-week highs / lows", tone: snapshot.highs52w >= snapshot.lows52w ? "positive" as const : "negative" as const } : unavailable) }
  ];
}
