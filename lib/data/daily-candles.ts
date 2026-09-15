import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { cryptoCandleAssets, marketCandleAssets, normalizeAppSymbol, toFinnhubShareClassSymbol } from "./market-assets";
import { readCachedSp500HeatmapRows } from "./adapters/unusual-whales-sp500-heatmap";

export const CANDLE_TABLES = ["sp500_daily_candles", "market_daily_candles", "crypto_daily_candles"] as const;
export type CandleTable = (typeof CANDLE_TABLES)[number];
export type DailyCandle = { symbol: string; providerSymbol: string; tradingDate: string; open: number; high: number; low: number; close: number; volume: number | null; previousClose: number | null; source: string; sourceTimestamp: string | null; fetchedAt: string; assetGroup?: string };
export const candleApiPayloadSchema = z.object({ symbol: z.string(), range: z.enum(["1W","1M","3M","YTD","1Y"]), table: z.enum(CANDLE_TABLES), available: z.boolean(), candles: z.array(z.object({ time: z.string(), date: z.string().optional(), open: z.number(), high: z.number(), low: z.number(), close: z.number(), volume: z.number().nullable(), previousClose: z.number().nullable() })), metadata: z.object({ source: z.string().nullable(), earliestTradingDate: z.string().nullable(), latestTradingDate: z.string().nullable(), fetchedAt: z.string().nullable(), rows: z.number(), label: z.string(), providerSymbol: z.string().nullable(), range: z.enum(["1W","1M","3M","YTD","1Y"]).optional(), resolution: z.enum(["1d","1h","30m","15m","5m","1m"]).default("1d"), marketCalendar: z.enum(["24/7","exchange","futures"]).default("exchange"), timezone: z.string().default("America/New_York"), supabaseProjectHost: z.string().nullable().optional(), dataVersion: z.string().optional() }) });
export type CandleRange = z.infer<typeof candleApiPayloadSchema>["range"];
export type CandleResolution = "1d" | "1h" | "30m" | "15m" | "5m" | "1m";
export type MarketCalendar = "24/7" | "exchange" | "futures";

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const numeric = (n: unknown) => typeof n === "number" ? (Number.isFinite(n) ? n : null) : typeof n === "string" && n.trim() !== "" ? (Number.isFinite(Number(n)) ? Number(n) : null) : null;
function positiveFinite(n: unknown) { const v = numeric(n); return v != null && v > 0 ? v : null; }
function nonNegativeFinite(n: unknown) { const v = numeric(n); return v != null && v >= 0 ? v : null; }
export function validateOhlc(open:number, high:number, low:number, close:number) { if (![open,high,low,close].every((n) => Number.isFinite(n) && n > 0)) throw new Error("OHLC values must be finite and positive"); if (high < open || high < close || low > open || low > close || high < low) throw new Error("Invalid OHLC relationship"); }
export function tradingDateFromProviderTimestamp(unixSeconds: number, timeZone = "America/New_York") { if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) throw new Error("Invalid provider timestamp"); return new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date(unixSeconds * 1000)); }
export function oneYearCutoff(today = new Date(), timeZone = "America/Toronto") { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(today); const y=Number(parts.find(p=>p.type==='year')?.value); const m=Number(parts.find(p=>p.type==='month')?.value); const d=Number(parts.find(p=>p.type==='day')?.value); const dt = new Date(Date.UTC(y - 1, m - 1, d)); return dt.toISOString().slice(0,10); }
export function parseProviderTradingDate(raw: unknown) { if (typeof raw === "string") { const s = raw.trim(); const ymd = /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0]; if (ymd) return { tradingDate: ymd, sourceTimestamp: s }; if (/^\d+$/.test(s)) return parseProviderTradingDate(Number(s)); return null; } if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) { const ms = raw > 10_000_000_000 ? raw : raw * 1000; const d = new Date(ms); if (Number.isNaN(d.getTime())) return null; return { tradingDate: d.toISOString().slice(0,10), sourceTimestamp: d.toISOString() }; } return null; }
export function normalizeFinnhubQuote(symbol:string, providerSymbol:string, quote: unknown, fetchedAt = new Date().toISOString()): DailyCandle { const q = quote as Record<string, unknown>; const open=positiveFinite(q.o), high=positiveFinite(q.h), low=positiveFinite(q.l), close=positiveFinite(q.c); if (open==null || high==null || low==null || close==null) throw new Error("Finnhub quote missing positive OHLC fields"); validateOhlc(open, high, low, close); const t = typeof q.t === "number" ? q.t : Math.floor(Date.now()/1000); return { symbol: normalizeAppSymbol(symbol), providerSymbol, tradingDate: tradingDateFromProviderTimestamp(t), open, high, low, close, volume:null, previousClose: positiveFinite(q.pc), source: "Finnhub", sourceTimestamp: new Date(t*1000).toISOString(), fetchedAt }; }

export type CandleParseDiagnostics = { candles: DailyCandle[]; rawCount: number; parsedCount: number; skippedCount: number; skippedReasons: Record<string, number>; arrayPath: string };
export function locateUnusualWhalesCandleArray(payload: unknown) { const paths: Array<[string, unknown]> = [["$", payload]]; if (isRecord(payload)) { paths.push(["data", payload.data], ["candles", payload.candles], ["results", payload.results], ["payload", payload.payload]); if (isRecord(payload.payload)) paths.push(["payload.data", payload.payload.data], ["payload.candles", payload.payload.candles], ["payload.results", payload.payload.results]); if (isRecord(payload.data)) paths.push(["data.candles", payload.data.candles], ["data.results", payload.data.results]); }
  for (const [path, value] of paths) if (Array.isArray(value)) return { rows:value, path };
  return { rows: [] as unknown[], path: "not_found" };
}
export function normalizeUnusualWhalesCandlesWithDiagnostics(symbol:string, providerSymbol:string, payload: unknown, source: "Unusual Whales" | "Unusual Whales Crypto" | "Unusual Whales Equity" = "Unusual Whales", fetchedAt = new Date().toISOString()): CandleParseDiagnostics { const { rows, path } = locateUnusualWhalesCandleArray(payload); const skippedReasons: Record<string, number> = {}; const skip=(r:string)=>{ skippedReasons[r]=(skippedReasons[r]??0)+1; };
  const candles = rows.flatMap((raw: unknown) => { if (!isRecord(raw)) { skip("row_not_object"); return []; } const date = parseProviderTradingDate(raw.date ?? raw.time ?? raw.start_time); if (!date) { skip("missing_or_malformed_date"); return []; } const open=positiveFinite(raw.o ?? raw.open), high=positiveFinite(raw.h ?? raw.high), low=positiveFinite(raw.l ?? raw.low), close=positiveFinite(raw.c ?? raw.close); if (open==null || high==null || low==null || close==null) { skip("missing_positive_ohlc"); return []; } const volumeRaw = raw.v ?? raw.volume; const volume = volumeRaw == null ? null : nonNegativeFinite(volumeRaw); if (volumeRaw != null && volume == null) { skip("invalid_volume"); return []; } try { validateOhlc(open, high, low, close); } catch { skip("invalid_ohlc_relationship"); return []; } return [{ symbol: normalizeAppSymbol(symbol), providerSymbol, tradingDate: date.tradingDate, open, high, low, close, volume, previousClose:null, source, sourceTimestamp: date.sourceTimestamp, fetchedAt }]; });
  return { candles, rawCount: rows.length, parsedCount: candles.length, skippedCount: rows.length - candles.length, skippedReasons, arrayPath: path };
}
export function normalizeUnusualWhalesCandles(symbol:string, providerSymbol:string, payload: unknown, source: "Unusual Whales" | "Unusual Whales Crypto" | "Unusual Whales Equity" = "Unusual Whales"): DailyCandle[] { return normalizeUnusualWhalesCandlesWithDiagnostics(symbol, providerSymbol, payload, source).candles; }
export async function getSp500CandleUniverse(client?: SupabaseClient) { const { rows } = await readCachedSp500HeatmapRows(client); return rows.map((r) => normalizeAppSymbol(r.ticker)).filter((s, i, a) => a.indexOf(s) === i).sort(); }
export function dailyCandleRowsForUpsert(table:CandleTable, candles: DailyCandle[]) { return candles.map(c => {
  const common = { symbol:c.symbol, provider_symbol:c.providerSymbol, trading_date:c.tradingDate, open:c.open, high:c.high, low:c.low, close:c.close, volume:c.volume, fetched_at:c.fetchedAt };
  if (table === "crypto_daily_candles") return common;
  const equity = { ...common, previous_close:c.previousClose, source:c.source };
  if (table === "market_daily_candles") return { ...equity, asset_group:c.assetGroup ?? null };
  return { ...equity, source_timestamp:c.sourceTimestamp };
}); }

export async function mergeVolumePreservingRows(table:CandleTable, rows: any[], client?: SupabaseClient) {
  if (!rows.some((r) => r.volume == null)) return rows;
  const supabase = client ? { ok:true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return rows;
  const eligibleNullRows = rows.filter((r) => r.volume == null && r.source !== "Unusual Whales Futures EOD");
  if (!eligibleNullRows.length) return rows;
  const symbols = Array.from(new Set(eligibleNullRows.map((r) => r.symbol)));
  const dates = Array.from(new Set(eligibleNullRows.map((r) => r.trading_date)));
  const { data } = await supabase.client.from(table).select("symbol,trading_date,volume").in("symbol", symbols).in("trading_date", dates);
  const existing = new Map((data ?? []).map((r:any) => [`${r.symbol}:${r.trading_date}`, r.volume]));
  return rows.map((r) => r.volume == null && r.source !== "Unusual Whales Futures EOD" && existing.get(`${r.symbol}:${r.trading_date}`) != null ? { ...r, volume: existing.get(`${r.symbol}:${r.trading_date}`) } : r);
}

function supabaseErrorMessage(error: any) { return JSON.stringify({ code:error?.code, message:error?.message, details:error?.details, hint:error?.hint }); }
export async function upsertDailyCandles(table:CandleTable, candles: DailyCandle[], client?: SupabaseClient) { if (!candles.length) return { upserted:0 }; const supabase = client ? { ok:true as const, client } : createServerSupabaseClient(); if (!supabase.ok) throw new Error(supabase.message); const rows = await mergeVolumePreservingRows(table, dailyCandleRowsForUpsert(table, candles), supabase.client); const { error } = await supabase.client.from(table).upsert(rows, { onConflict:"symbol,trading_date" }); if (error) throw new Error(`Supabase ${table} upsert failed: ${supabaseErrorMessage(error)}`); return { upserted: rows.length }; }
export async function pruneDailyCandles(table:CandleTable, cutoff = oneYearCutoff(), client?: SupabaseClient) { const supabase = client ? { ok:true as const, client } : createServerSupabaseClient(); if (!supabase.ok) throw new Error(supabase.message); const { count, error } = await supabase.client.from(table).delete({ count:"exact" }).lt("trading_date", cutoff); if (error) throw new Error(`Supabase ${table} prune failed: ${supabaseErrorMessage(error)}`); return count ?? 0; }
function daysInMonth(year:number, monthIndex:number){ return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(); }
function addMonths(date:string, months:number){ const [y,m,d]=date.split("-").map(Number); const targetIndex=m-1+months; const targetYear=y+Math.floor(targetIndex/12); const targetMonth=((targetIndex%12)+12)%12; const day=Math.min(d, daysInMonth(targetYear,targetMonth)); return new Date(Date.UTC(targetYear,targetMonth,day)).toISOString().slice(0,10); }
function addYears(date:string, years:number){ const [y,m,d]=date.split("-").map(Number); const day=Math.min(d, daysInMonth(y+years,m-1)); return new Date(Date.UTC(y+years,m-1,day)).toISOString().slice(0,10); }
function addDays(date:string, days:number){ const [y,m,d]=date.split("-").map(Number); const dt=new Date(Date.UTC(y,m-1,d+days)); return dt.toISOString().slice(0,10); }
export function candleRangeBounds(range:CandleRange, latest:string, resolution:CandleResolution="1d"){ void resolution; if(range==="1W") return { from:addDays(latest,-6), to:latest }; if(range==="1M") return { from:addMonths(latest,-1), to:latest }; if(range==="3M") return { from:addMonths(latest,-3), to:latest }; if(range==="YTD") return { from:`${latest.slice(0,4)}-01-01`, to:latest }; return { from:addYears(latest,-1), to:latest }; }
export async function readCandlesForApi(input:CandleTable | {table:CandleTable; symbol:string; range:CandleRange; marketCalendar?:MarketCalendar; timezone?:string; client?:SupabaseClient}, legacySymbol?:string, legacyRange?:CandleRange, legacyClient?:SupabaseClient) { const opts = typeof input === "string" ? { table:input, symbol:legacySymbol!, range:legacyRange!, marketCalendar: input==="crypto_daily_candles"?"24/7" as const:"exchange" as const, timezone: input==="crypto_daily_candles"?"UTC":"America/New_York", client:legacyClient } : input; const supabase = opts.client ? { ok:true as const, client: opts.client } : createServerSupabaseClient(); if (!supabase.ok) throw new Error(supabase.message); const sym=normalizeAppSymbol(opts.symbol); const latestRes = await supabase.client.from(opts.table).select("trading_date").eq("symbol", sym).order("trading_date", { ascending:false }).limit(1); if (latestRes.error) throw new Error(`Supabase ${opts.table} latest read failed: ${supabaseErrorMessage(latestRes.error)}`); const latest = latestRes.data?.[0]?.trading_date; if(!latest) return []; const bounds=candleRangeBounds(opts.range, latest, "1d"); const selectedColumns = opts.table === "crypto_daily_candles" ? "trading_date,open,high,low,close,volume,fetched_at" : "trading_date,open,high,low,close,volume,previous_close,source,fetched_at"; const { data, error } = await supabase.client.from(opts.table).select(selectedColumns).eq("symbol", sym).gte("trading_date", bounds.from).lte("trading_date", bounds.to).order("trading_date", { ascending:true }); if (error) throw new Error(`Supabase ${opts.table} read failed: ${supabaseErrorMessage(error)}`); const seen=new Set<string>(); return (data ?? []).filter((r:any)=>{ if(seen.has(r.trading_date)) return false; seen.add(r.trading_date); return [r.open,r.high,r.low,r.close].every((n:any)=>Number.isFinite(Number(n))&&Number(n)>0); }); }
export function configuredCounts(sp500Count:number) { return { sp500: sp500Count, markets: marketCandleAssets.filter(a=>a.chartAvailable).length, crypto: cryptoCandleAssets.length }; }
export function finnhubProviderSymbol(symbol:string) { return toFinnhubShareClassSymbol(symbol); }

export async function readSp500CandlesForBreadth(symbols: string[], client?: SupabaseClient) {
  if (!symbols.length) return [] as DailyCandle[];
  const supabase = client ? { ok:true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return [] as DailyCandle[];
  const { data, error } = await supabase.client
    .from("sp500_daily_candles")
    .select("symbol,provider_symbol,trading_date,open,high,low,close,volume,previous_close,source,source_timestamp,fetched_at")
    .in("symbol", symbols);
  if (error) return [] as DailyCandle[];
  return (data ?? []).map((r: any) => ({ symbol:r.symbol, providerSymbol:r.provider_symbol, tradingDate:r.trading_date, open:Number(r.open), high:Number(r.high), low:Number(r.low), close:Number(r.close), volume:r.volume == null ? null : Number(r.volume), previousClose:r.previous_close == null ? null : Number(r.previous_close), source:r.source, sourceTimestamp:r.source_timestamp, fetchedAt:r.fetched_at }));
}
