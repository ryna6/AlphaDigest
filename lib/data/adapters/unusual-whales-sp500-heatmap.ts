import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { getHeatmapIconPath } from "@/lib/constants/asset-icons";
import type { HeatmapTile, Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const UW_SP500_HEATMAP_URL = "https://phx.unusualwhales.com/api/sector/heatmap/options?date_range=one_day";
const TABLE = "unusual_whales_sp500_heatmap";
const SOURCE = "unusual_whales_sp500_heatmap";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && v.trim() ? Number(v.replace(/[$,% ,]/g, "")) || null : null;

export const STATE_STREET_SECTORS = [
  "Technology",
  "Utilities",
  "Financials",
  "Health Care",
  "Energy",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Materials",
  "Communication Services",
  "Real Estate"
] as const;

const SECTOR_MAP: Record<string, string> = {
  technology: "Technology",
  utilities: "Utilities",
  "financial services": "Financials",
  financials: "Financials",
  "health care": "Health Care",
  healthcare: "Health Care",
  energy: "Energy",
  "consumer cyclical": "Consumer Discretionary",
  "consumer discretionary": "Consumer Discretionary",
  "consumer defensive": "Consumer Staples",
  "consumer staples": "Consumer Staples",
  industrials: "Industrials",
  "basic materials": "Materials",
  materials: "Materials",
  "communication services": "Communication Services",
  "real estate": "Real Estate"
};

export function normalizeSp500Sector(value: string | null | undefined) {
  const key = value?.trim().replace(/\s+/g, " ").toLowerCase();
  return key ? SECTOR_MAP[key] ?? "Other" : "Other";
}

export type Sp500HeatmapRow = {
  ticker: string;
  sector: string | null;
  normalizedSector: string;
  marketcap: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  prevClose: number;
  tapeTime: string;
  asOfDate: string;
  fetchedAt: string;
};

function extractRows(json: unknown) {
  if (Array.isArray(json)) return json;
  if (!isRec(json)) return [];
  for (const key of ["data", "results", "rows", "items"]) {
    const value = json[key];
    if (Array.isArray(value)) return value;
    if (isRec(value) && Array.isArray(value.data)) return value.data;
  }
  return [];
}

function dateKey(value: string | null, fallbackIso: string) {
  const source = value ?? fallbackIso;
  const parsed = new Date(source);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : fallbackIso.slice(0, 10);
}

export function normalizeSp500HeatmapPayload(payload: unknown, fetchedAt = new Date().toISOString()) {
  const rawRows = extractRows(payload);
  const rows = rawRows.map((v) => {
    if (!isRec(v)) return null;
    const ticker = str(v.ticker)?.toUpperCase();
    const close = num(v.close);
    const prevClose = num(v.prev_close ?? v.prevClose);
    const marketcap = num(v.marketcap ?? v.market_cap);
    const tapeTime = str(v.tape_time ?? v.tapeTime) ?? fetchedAt;
    if (!ticker || close == null || prevClose == null || prevClose <= 0 || marketcap == null || marketcap <= 0) return null;
    const sector = str(v.sector);
    return {
      ticker,
      sector,
      normalizedSector: normalizeSp500Sector(sector),
      marketcap,
      open: num(v.open),
      high: num(v.high),
      low: num(v.low),
      close,
      prevClose,
      tapeTime,
      asOfDate: dateKey(tapeTime, fetchedAt),
      fetchedAt
    } satisfies Sp500HeatmapRow;
  }).filter((row): row is Sp500HeatmapRow => !!row);
  return { rows, rawCount: rawRows.length, skipped: rawRows.length - rows.length };
}

function headers(): Record<string, string> {
  const token = process.env.UNUSUAL_WHALES_API_KEY ?? process.env.UW_API_KEY;
  return token ? { accept: "application/json", authorization: `Bearer ${token}` } : { accept: "application/json" };
}

export async function fetchSp500HeatmapRows() {
  const res = await fetch(UW_SP500_HEATMAP_URL, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Unusual Whales S&P 500 heatmap fetch failed: ${res.status}`);
  return normalizeSp500HeatmapPayload(await res.json());
}

function toDb(row: Sp500HeatmapRow) {
  return {
    id: `${row.asOfDate}:${row.ticker}`,
    ticker: row.ticker,
    sector: row.sector,
    normalized_sector: row.normalizedSector,
    marketcap: row.marketcap,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    prev_close: row.prevClose,
    tape_time: row.tapeTime,
    as_of_date: row.asOfDate,
    fetched_at: row.fetchedAt,
    content_hash: stableHash(row)
  };
}

export async function refreshSp500Heatmap() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message, persisted: false });
  try {
    const normalized = await fetchSp500HeatmapRows();
    const rows = normalized.rows;
    const contentHash = payloadContentHash(rows);
    if (!rows.length) {
      await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: false, rowCount: 0, contentHash, error: "Provider returned zero valid S&P 500 heatmap rows.", meta: normalized });
      return sourceResult({ ok: false, count: 0, changed: false, contentHash, error: "Provider returned zero valid rows.", persisted: false, meta: normalized });
    }
    const asOfDate = rows[0]?.asOfDate;
    const { error } = await supabase.client.from(TABLE).upsert(rows.map(toDb), { onConflict: "id" });
    if (error) throw error;
    const { count: pruneCount, error: pruneError } = await supabase.client.from(TABLE).delete({ count: "exact" }).lt("as_of_date", asOfDate);
    if (pruneError) throw pruneError;
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: rows.length, contentHash, meta: { rawCount: normalized.rawCount, skipped: normalized.skipped, asOfDate, prunedPriorRows: pruneCount ?? 0 } });
    return sourceResult({ ok: true, count: rows.length, changed: true, contentHash, upserted: rows.length, persisted: true, meta: { ...normalized, asOfDate, prunedPriorRows: pruneCount ?? 0 } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown S&P 500 heatmap refresh error";
    try { await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: false, rowCount: 0, error: message }); } catch {}
    return sourceResult({ ok: false, count: 0, error: message, persisted: false });
  }
}

function fromDb(row: Rec): Sp500HeatmapRow | null {
  const ticker = str(row.ticker)?.toUpperCase();
  const close = num(row.close); const prevClose = num(row.prev_close); const marketcap = num(row.marketcap);
  const tapeTime = str(row.tape_time) ?? str(row.fetched_at) ?? new Date().toISOString();
  const asOfDate = str(row.as_of_date) ?? dateKey(tapeTime, new Date().toISOString());
  if (!ticker || close == null || prevClose == null || prevClose <= 0 || marketcap == null || marketcap <= 0) return null;
  const sector = str(row.sector);
  return { ticker, sector, normalizedSector: str(row.normalized_sector) ?? normalizeSp500Sector(sector), marketcap, open: num(row.open), high: num(row.high), low: num(row.low), close, prevClose, tapeTime, asOfDate, fetchedAt: str(row.fetched_at) ?? new Date().toISOString() };
}

export async function readCachedSp500HeatmapRows(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return { rows: [] as Sp500HeatmapRow[], message: supabase.message };
  const { data, error } = await supabase.client.from(TABLE).select("ticker,sector,normalized_sector,marketcap,open,high,low,close,prev_close,tape_time,as_of_date,fetched_at").order("marketcap", { ascending: false });
  if (error) return { rows: [], message: error.message };
  return { rows: (data ?? []).map((r) => fromDb(r as Rec)).filter((r): r is Sp500HeatmapRow => !!r) };
}

export function sp500RowsToTiles(rows: Sp500HeatmapRow[]): HeatmapTile[] {
  return rows.map((row) => ({ symbol: row.ticker, label: row.ticker, value: row.close, changePercent: ((row.close - row.prevClose) / row.prevClose) * 100, weight: row.marketcap, sector: row.normalizedSector, iconPath: getHeatmapIconPath(row.ticker) }));
}

export function sp500Breadth(rows: Sp500HeatmapRow[]): Metric[] {
  const adv = rows.filter((r) => r.close > r.prevClose).length;
  const dec = rows.filter((r) => r.close < r.prevClose).length;
  const unchanged = rows.length - adv - dec;
  const participation = rows.length ? ((adv + dec) / rows.length) * 100 : null;
  return [
    { label: "Participation", value: participation == null ? "—" : `${(adv + dec).toLocaleString()}/${rows.length.toLocaleString()} (${participation.toFixed(1)}%)`, subtext: unchanged ? `${unchanged} unchanged` : "Equal-weight S&P 500 constituents", tone: "neutral" },
    { label: "Advancers / Decliners", value: rows.length ? `${adv.toLocaleString()} / ${dec.toLocaleString()}` : "—", subtext: "Close vs previous close", tone: adv >= dec ? "positive" : "negative" },
    { label: "% Above 50D MA", value: "—", subtext: "Not yet available", tone: "neutral" },
    { label: "New Highs / Lows", value: "—", subtext: "Not yet available", tone: "neutral" }
  ];
}

export function sp500Movers(rows: Sp500HeatmapRow[]): Metric[] {
  const movers = rows.map((r) => ({ r, pct: ((r.close - r.prevClose) / r.prevClose) * 100 })).filter((m) => Number.isFinite(m.pct));
  const fmt = (m: typeof movers[number]) => `${m.r.ticker} ${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(2)}% @ $${m.r.close.toFixed(2)}`;
  const leaders = [...movers].sort((a, b) => b.pct - a.pct).slice(0, 3).map(fmt).join(" · ");
  const laggards = [...movers].sort((a, b) => a.pct - b.pct).slice(0, 3).map(fmt).join(" · ");
  return [
    { label: "Leaders", value: leaders || "—", tone: "positive" },
    { label: "Laggards", value: laggards || "—", tone: "negative" }
  ];
}
