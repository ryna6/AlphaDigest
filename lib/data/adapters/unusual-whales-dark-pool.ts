import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { DarkPoolFlowRow } from "@/lib/data/schemas/dashboard";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const UW_DARK_POOL_URL = "https://phx.unusualwhales.com/api/flow/dark-pool?tab=dark-pool&limit=250&min_premium=10000000&min_marketcap=5000000000&min_size_avg30d_vol_perc=0.05&min_size_daily_perc=0.15&min_size=250000&min_price=5&order=Prem&hide_index_etf=true&max_marketcap=100000000000&max_size_daily_perc=0.5&max_size_avg30d_vol_perc=0.25";
const SOURCE = "unusual_whales_dark_pool_flows";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v): v is string => typeof v === "string" && !!v.trim())?.trim() ?? null;
const num = (v: unknown) => typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && v.trim() ? Number(v.replace(/[$,]/g, "")) || null : null;
const rowsFrom = (payload: unknown): Rec[] => Array.isArray(payload) ? payload.filter(isRec) : isRec(payload) && Array.isArray(payload.data) ? payload.data.filter(isRec) : [];

export function normalizeDarkPoolPayload(payload: unknown, fetchedAt = new Date().toISOString()): DarkPoolFlowRow[] {
  return rowsFrom(payload).map((r) => {
    const ticker = str(r, ["ticker", "symbol"])?.toUpperCase();
    const executedAt = str(r, ["executed_at", "executedAt", "time", "timestamp", "created_at"]);
    if (!ticker || !executedAt) return null;
    const row = {
      externalId: stableHash({ ticker, executedAt, price: num(r.price), premium: num(r.premium), volume: num(r.volume ?? r.size) }),
      executedAt: new Date(executedAt).toISOString(),
      ticker,
      sector: str(r, ["sector"]),
      price: num(r.price),
      premium: num(r.premium),
      volume: num(r.volume ?? r.size),
      fetchedAt
    };
    return row;
  }).filter(Boolean) as DarkPoolFlowRow[];
}

export async function readDarkPoolRows(client: SupabaseClient, limit = 50) {
  const { data, error } = await client.from("unusual_whales_dark_pool_flows").select("external_id,executed_at,ticker,sector,price,premium,volume,fetched_at").order("premium", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ externalId: r.external_id, executedAt: r.executed_at, ticker: r.ticker, sector: r.sector, price: r.price == null ? null : Number(r.price), premium: r.premium == null ? null : Number(r.premium), volume: r.volume == null ? null : Number(r.volume), fetchedAt: r.fetched_at })) satisfies DarkPoolFlowRow[];
}

export async function refreshDarkPoolFlows() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message });
  try {
    const res = await fetch(UW_DARK_POOL_URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Unusual Whales dark pool fetch failed: ${res.status}`);
    const payload = await res.json();
    const fetched = rowsFrom(payload).length;
    const rows = normalizeDarkPoolPayload(payload);
    const dbRows = rows.map((r) => ({ external_id: r.externalId, executed_at: r.executedAt, ticker: r.ticker, sector: r.sector, price: r.price, premium: r.premium, volume: r.volume, fetched_at: r.fetchedAt, updated_at: new Date().toISOString() }));
    if (dbRows.length) {
      const { error } = await supabase.client.from("unusual_whales_dark_pool_flows").upsert(dbRows, { onConflict: "external_id" });
      if (error) throw new Error(`Dark pool upsert failed: ${error.message}`);
    }
    const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { count: pruned, error: pruneError } = await supabase.client.from("unusual_whales_dark_pool_flows").delete({ count: "exact" }).lt("executed_at", cutoff);
    if (pruneError) throw new Error(`Dark pool prune failed: ${pruneError.message}`);
    const contentHash = payloadContentHash(rows);
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: rows.length, contentHash, meta: { fetched, normalized: rows.length, upserted: dbRows.length, pruned: pruned ?? 0, retentionDays: 7 } });
    return sourceResult({ ok: true, count: rows.length, changed: true, contentHash, upserted: dbRows.length, meta: { fetched, normalized: rows.length, pruned: pruned ?? 0 } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown dark pool refresh error";
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: null, rowCount: 0, error: message }).catch(() => undefined);
    return sourceResult({ ok: false, count: 0, error: message });
  }
}
