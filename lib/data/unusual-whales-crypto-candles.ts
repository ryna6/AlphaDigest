import { createServerSupabaseClient } from "@/lib/db/supabase";
import { normalizeUnusualWhalesCandlesWithDiagnostics, type DailyCandle } from "./daily-candles";
import { cryptoCandleAssets } from "./market-assets";

export const UW_CRYPTO_CANDLE_START_DATE = "2025-07-10";
export const UW_CRYPTO_CANDLE_BASE_URL = "https://phx.unusualwhales.com/api/crypto_candles";
export const UW_CRYPTO_VOLUME_MIGRATION = "0037_daily_candle_volume";
export const cryptoCandleEndpointAssets = cryptoCandleAssets.map((asset) => ({ symbol: asset.symbol, label: asset.label, providerSymbol: asset.unusualWhalesSymbol! }));
export function buildUnusualWhalesCryptoCandleUrl(providerSymbol: string, startDate = UW_CRYPTO_CANDLE_START_DATE) { return `${UW_CRYPTO_CANDLE_BASE_URL}/${encodeURIComponent(providerSymbol)}/1d/${startDate}`; }
export function getUnusualWhalesApiKey() { return process.env.UNUSUAL_WHALES_API_KEY ?? process.env.UW_API_KEY ?? null; }
function bounded(s: string, n = 240) { return s.length > n ? `${s.slice(0,n)}…` : s; }
function isRecord(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function providerMessage(json: unknown) { return isRecord(json) ? [json.error, json.message, json.detail, json.reason].find((v): v is string => typeof v === "string" && v.trim().length > 0) ?? null : null; }
export type CryptoCandleFetchResult =
 | { ok:true; symbol:string; providerSymbol:string; url:string; status:number; rawCount:number; parsedCount:number; skippedCount:number; candles:DailyCandle[]; diagnostics:{ contentType:string|null; responseLength:number; arrayPath:string; topLevelType:string; topLevelKeys:string[]; finalUrl:string } }
 | { ok:false; symbol:string; providerSymbol:string; url:string; status?:number; stage:"request"|"http"|"response_type"|"json"|"provider"|"parse"|"database"|"verification"; error:string; diagnostics?:Record<string, unknown> };
export async function fetchUnusualWhalesCryptoCandles(symbol: string, providerSymbol: string, startDate = UW_CRYPTO_CANDLE_START_DATE): Promise<CryptoCandleFetchResult> {
  const url = buildUnusualWhalesCryptoCandleUrl(providerSymbol, startDate); const headers: Record<string,string> = { Accept:"application/json", "User-Agent":"AlphaDigest/1.0 (+server-side crypto candle refresh)" }; const token = getUnusualWhalesApiKey(); if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response; try { res = await fetch(url, { cache:"no-store", headers }); } catch (e) { return { ok:false, symbol, providerSymbol, url, stage:"request", error:bounded((e as Error).message) }; }
  const text = await res.text(); const contentType = res.headers.get("content-type"); const diagnostics = { contentType, responseLength:text.length, finalUrl:res.url };
  if (!res.ok) return { ok:false, symbol, providerSymbol, url, status:res.status, stage:"http", error:`Unusual Whales crypto HTTP ${res.status}`, diagnostics };
  if (/^\s*</.test(text) || contentType?.toLowerCase().includes("text/html")) return { ok:false, symbol, providerSymbol, url, status:res.status, stage:"response_type", error:"Unusual Whales crypto endpoint returned HTML instead of JSON", diagnostics };
  let json: unknown; try { json = JSON.parse(text); } catch (e) { return { ok:false, symbol, providerSymbol, url, status:res.status, stage:"json", error:bounded((e as Error).message), diagnostics }; }
  const msg = providerMessage(json); if (msg && !Array.isArray(json) && !(isRecord(json) && (Array.isArray(json.data) || Array.isArray(json.payload)))) return { ok:false, symbol, providerSymbol, url, status:res.status, stage:"provider", error:bounded(msg), diagnostics:{...diagnostics, topLevelKeys:isRecord(json)?Object.keys(json).slice(0,20):[]} };
  const parsed = normalizeUnusualWhalesCandlesWithDiagnostics(symbol, providerSymbol, json, "Unusual Whales Crypto");
  const topLevelType = Array.isArray(json) ? "array" : isRecord(json) ? "object" : typeof json; const topLevelKeys = isRecord(json) ? Object.keys(json).slice(0,20) : [];
  if (parsed.rawCount === 0) return { ok:false, symbol, providerSymbol, url, status:res.status, stage:"parse", error:"Unusual Whales crypto response contained zero candle rows", diagnostics:{...diagnostics, arrayPath:parsed.arrayPath, topLevelType, topLevelKeys} };
  if (parsed.parsedCount === 0) return { ok:false, symbol, providerSymbol, url, status:res.status, stage:"parse", error:"Unusual Whales crypto response produced zero valid candle rows", diagnostics:{...diagnostics, arrayPath:parsed.arrayPath, skippedReasons:parsed.skippedReasons, rawCount:parsed.rawCount, topLevelType, topLevelKeys} };
  return { ok:true, symbol, providerSymbol, url, status:res.status, rawCount:parsed.rawCount, parsedCount:parsed.parsedCount, skippedCount:parsed.skippedCount, candles:parsed.candles, diagnostics:{...diagnostics, arrayPath:parsed.arrayPath, topLevelType, topLevelKeys} };
}
export async function verifyCryptoCandleDatabaseReady() { const supabase = createServerSupabaseClient(); if (!supabase.ok) return { ok:false as const, error:supabase.message }; const { error } = await supabase.client.from("crypto_daily_candles").select("symbol,provider_symbol,trading_date,open,high,low,close,volume,previous_close,source,source_timestamp,fetched_at").limit(0); if (error) return { ok:false as const, error:`crypto_daily_candles is unavailable or migration ${UW_CRYPTO_VOLUME_MIGRATION} has not been applied. ${JSON.stringify({ code:error.code, message:error.message, details:error.details, hint:error.hint })}` }; return { ok:true as const, supabase:supabase.client, projectUrl: process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null }; }
