import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { InsiderTradeRow } from "@/lib/data/schemas/dashboard";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const UW_INSIDER_TRADES_URL = "https://phx.unusualwhales.com/api/insider_trades/feed?transaction_codes[]=P&transaction_codes[]=S&limit=500&min_value=500000&min_marketcap=500000000&common_stock_only=true&max_marketcap=20000000000&min_earnings_dte=7&max_earnings_dte=60&min_price=5&min_amount=25000&is_director=true&exclude_10b5_1=true&group=true";
const SOURCE = "unusual_whales_insider_trades";
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const rowsFrom = (payload: unknown): Rec[] => Array.isArray(payload) ? payload.filter(isRec) : isRec(payload) && Array.isArray(payload.data) ? payload.data.filter(isRec) : [];
const str = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v): v is string => typeof v === "string" && !!v.trim())?.trim() ?? null;
const num = (v: unknown) => typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && v.trim() ? Number(v.replace(/[$,]/g, "")) || null : null;
const cutoffDate = () => new Date(Date.now() - 92 * 86400_000).toISOString().slice(0, 10);

export function normalizeInsiderTradesPayload(payload: unknown, fetchedAt = new Date().toISOString()): { rows: InsiderTradeRow[]; fetched: number; filtered: number } {
  const cutoff = cutoffDate();
  const raw = rowsFrom(payload);
  let filtered = 0;
  const rows = raw.map((r) => {
    const ticker = str(r, ["ticker", "symbol"])?.toUpperCase();
    const transactionDate = str(r, ["transaction_date", "transactionDate", "date", "filing_date"]);
    const code = str(r, ["transaction_code", "transactionCode", "code"])?.toUpperCase();
    if (!ticker || !transactionDate || (code !== "P" && code !== "S")) return null;
    const date = transactionDate.slice(0, 10);
    if (date < cutoff) { filtered += 1; return null; }
    const absAmount = Math.abs(num(r.amount ?? r.shares ?? r.share_amount) ?? 0);
    const amount = code === "S" ? -absAmount : absAmount;
    return { externalId: stableHash({ ticker, date, owner: str(r, ["owner_name", "ownerName", "insider_name", "name"]), code, amount, price: num(r.price) }), ticker, sector: str(r, ["sector"]), amount, transactionDate: date, price: num(r.price), ownerName: str(r, ["owner_name", "ownerName", "insider_name", "name"]), officerTitle: str(r, ["officer_title", "officerTitle", "title"]), transactionCode: code as "P" | "S", sharesOwnedAfter: num(r.shares_owned_after ?? r.sharesOwnedAfter), fetchedAt };
  }).filter(Boolean) as InsiderTradeRow[];
  return { rows, fetched: raw.length, filtered };
}

export async function readInsiderTradeRows(client: SupabaseClient, ticker?: string, limit = 500) {
  const cutoff = cutoffDate();
  let q = client.from("unusual_whales_insider_trades").select("external_id,ticker,sector,amount,transaction_date,price,owner_name,officer_title,transaction_code,shares_owned_after,fetched_at").gte("transaction_date", cutoff).order("transaction_date", { ascending: false }).limit(limit);
  if (ticker) q = q.eq("ticker", ticker.toUpperCase());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ externalId: r.external_id, ticker: r.ticker, sector: r.sector, amount: Number(r.amount ?? 0), transactionDate: r.transaction_date, price: r.price == null ? null : Number(r.price), ownerName: r.owner_name, officerTitle: r.officer_title, transactionCode: r.transaction_code, sharesOwnedAfter: r.shares_owned_after == null ? null : Number(r.shares_owned_after), fetchedAt: r.fetched_at })) satisfies InsiderTradeRow[];
}

export async function refreshInsiderTrades() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message });
  try {
    const res = await fetch(UW_INSIDER_TRADES_URL, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Unusual Whales insider fetch failed: ${res.status}`);
    const payload = await res.json();
    const normalized = normalizeInsiderTradesPayload(payload);
    const dbRows = normalized.rows.map((r) => ({ external_id: r.externalId, ticker: r.ticker, sector: r.sector, amount: r.amount, transaction_date: r.transactionDate, price: r.price, owner_name: r.ownerName, officer_title: r.officerTitle, transaction_code: r.transactionCode, shares_owned_after: r.sharesOwnedAfter, fetched_at: r.fetchedAt, updated_at: new Date().toISOString() }));
    if (dbRows.length) {
      const { error } = await supabase.client.from("unusual_whales_insider_trades").upsert(dbRows, { onConflict: "external_id" });
      if (error) throw new Error(`Insider trades upsert failed: ${error.message}`);
    }
    const contentHash = payloadContentHash(normalized.rows);
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: normalized.rows.length, contentHash, meta: { fetched: normalized.fetched, normalized: normalized.rows.length, filtered: normalized.filtered, upserted: dbRows.length, window: "past_3_months" } });
    return sourceResult({ ok: true, count: normalized.rows.length, changed: true, contentHash, upserted: dbRows.length, meta: { fetched: normalized.fetched, normalized: normalized.rows.length, filtered: normalized.filtered } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown insider refresh error";
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: null, rowCount: 0, error: message }).catch(() => undefined);
    return sourceResult({ ok: false, count: 0, error: message });
  }
}
