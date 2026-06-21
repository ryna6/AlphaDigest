import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { WhaleFeedRow } from "@/lib/data/schemas/dashboard";
import { stableHash } from "./unusual-whales-earnings";
import { extractArrayFromUnusualWhalesResponse } from "./unusual-whales-dark-pool";
import { inferTradeSideFromNbbo } from "./nbbo-side";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const UW_WHALE_FEED_URL =
  "https://phx.unusualwhales.com/api/flow/lit-trades?tab=whale&limit=500&min_marketcap=10000000000&min_price=10&min_premium=10000000&min_size_avg30d_vol_perc=0.01&min_size_daily_perc=0.05&hide_index_etf=true&min_size=100000&order=Prem&max_size_avg30d_vol_perc=0.25&max_size_daily_perc=0.5";
const SOURCE = "unusual_whales_whale_feed";
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v): v is string => typeof v === "string" && !!v.trim())?.trim() ?? null;
const num = (v: unknown) => typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && v.trim() ? Number(v.replace(/[$,% ,]/g, "")) || null : null;
const safeKeys = (value: unknown, limit = 20) => isRec(value) ? Object.keys(value).slice(0, limit) : [];

export function normalizeWhaleFeedPayload(payload: unknown, fetchedAt = new Date().toISOString()) {
  const extracted = extractArrayFromUnusualWhalesResponse(payload);
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string) => { skipReasons[reason] = (skipReasons[reason] ?? 0) + 1; };
  const rows = extracted.rows.map((value) => {
    if (!isRec(value)) { skip("non_object_row"); return null; }
    const ticker = str(value, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
    const executedAtRaw = str(value, ["executed_at", "executedAt", "timestamp", "time", "created_at"]);
    if (!ticker) { skip("missing_ticker"); return null; }
    if (!executedAtRaw) { skip("missing_executed_at"); return null; }
    const executedAt = new Date(executedAtRaw);
    if (Number.isNaN(executedAt.getTime())) { skip("invalid_executed_at"); return null; }
    const price = num(value.price);
    const nbboBid = num(value.nbbo_bid ?? value.nbboBid);
    const nbboAsk = num(value.nbbo_ask ?? value.nbboAsk);
    const directSide = str(value, ["side"]);
    const inferred = directSide === "ask" || directSide === "bid" ? { side: directSide, sentiment: directSide === "ask" ? "bullish" : "bearish" } as const : inferTradeSideFromNbbo({ price, nbbo_bid: nbboBid, nbbo_ask: nbboAsk });
    const premium = num(value.premium ?? value.prem ?? value.notional ?? value.value);
    const size = num(value.size ?? value.trade_size);
    const volume = num(value.volume ?? value.vol);
    const avg30Volume = num(value.avg30_volume ?? value.avg_30_day_volume ?? value.avg30Volume);
    return {
      externalId: stableHash({ ticker, executedAt: executedAt.toISOString(), price, premium, size }),
      executedAt: executedAt.toISOString(), ticker, sector: str(value, ["sector", "stock_sector"]), price,
      nbboAsk, nbboBid, side: inferred.side, sentiment: inferred.sentiment, premium, size, volume, avg30Volume, fetchedAt
    };
  }).filter(Boolean) as WhaleFeedRow[];
  const deduped = [...new Map(rows.map((r) => [r.externalId, r])).values()];
  return { rows: deduped, rawCount: extracted.rows.length, skipped: extracted.rows.length - rows.length, skipReasons, duplicatesRemoved: rows.length - deduped.length, responsePath: extracted.path, emptyReason: extracted.rows.length === 0 ? extracted.reason : deduped.length === 0 ? "all_rows_skipped" : undefined };
}

export async function readWhaleFeedRows(client: SupabaseClient, limit = 100) {
  const { data, error } = await client.from("unusual_whales_whale_feed").select("external_id,executed_at,ticker,sector,price,nbbo_ask,nbbo_bid,side,sentiment,premium,size,volume,avg30_volume,fetched_at").order("premium", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ externalId: r.external_id, executedAt: r.executed_at, ticker: r.ticker, sector: r.sector, price: r.price == null ? null : Number(r.price), nbboAsk: r.nbbo_ask == null ? null : Number(r.nbbo_ask), nbboBid: r.nbbo_bid == null ? null : Number(r.nbbo_bid), side: r.side ?? "unknown", sentiment: r.sentiment ?? "unknown", premium: r.premium == null ? null : Number(r.premium), size: r.size == null ? null : Number(r.size), volume: r.volume == null ? null : Number(r.volume), avg30Volume: r.avg30_volume == null ? null : Number(r.avg30_volume), fetchedAt: r.fetched_at })) satisfies WhaleFeedRow[];
}

export async function refreshWhaleFeed() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message });
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(UW_WHALE_FEED_URL, { headers: { accept: "application/json" } });
    const fetchDiagnostics = { status: res.status, ok: res.ok, contentType: res.headers.get("content-type") };
    if (!res.ok) throw new Error(`Unusual Whales whale feed fetch failed: ${res.status}`);
    const payload = await res.json();
    const normalized = normalizeWhaleFeedPayload(payload, fetchedAt);
    console.log("whale_feed_response_diagnostics", { ...fetchDiagnostics, topLevelKeys: safeKeys(payload), responsePath: normalized.responsePath, rawCount: normalized.rawCount, normalized: normalized.rows.length, skipped: normalized.skipped, duplicatesRemoved: normalized.duplicatesRemoved });
    if (!normalized.responsePath) throw new Error(`Unable to locate whale feed rows: ${normalized.emptyReason ?? "no_supported_array_path"}`);
    const dbRows = normalized.rows.map((r) => ({ external_id: r.externalId, executed_at: r.executedAt, ticker: r.ticker, sector: r.sector, price: r.price, nbbo_ask: r.nbboAsk, nbbo_bid: r.nbboBid, side: r.side, sentiment: r.sentiment, premium: r.premium, size: r.size, volume: r.volume, avg30_volume: r.avg30Volume, fetched_at: r.fetchedAt, updated_at: fetchedAt }));
    if (dbRows.length) { const { error } = await supabase.client.from("unusual_whales_whale_feed").upsert(dbRows, { onConflict: "external_id" }); if (error) throw new Error(`Whale feed upsert failed: ${error.message}`); }
    const ok = !(normalized.rawCount > 0 && normalized.rows.length === 0);
    const error = ok ? null : "Whale feed response contained rows, but none had required ticker/executed_at fields";
    const meta = { fetched: normalized.rawCount, rawCount: normalized.rawCount, normalized: normalized.rows.length, skipped: normalized.skipped, skipReasons: normalized.skipReasons, duplicatesRemoved: normalized.duplicatesRemoved, upserted: dbRows.length, responsePath: normalized.responsePath, emptyReason: normalized.emptyReason, fetch: fetchDiagnostics };
    const contentHash = payloadContentHash(normalized.rows);
    await updateRefreshMetadata(supabase.client, SOURCE, { ok, changed: true, rowCount: normalized.rows.length, contentHash, error, meta });
    return sourceResult({ ok, count: normalized.rows.length, changed: true, error, contentHash, upserted: dbRows.length, meta });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown whale feed refresh error";
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: null, rowCount: 0, error: message }).catch(() => undefined);
    return sourceResult({ ok: false, count: 0, error: message });
  }
}
