import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { InsiderTradeRow } from "@/lib/data/schemas/dashboard";
import { stableHash } from "./unusual-whales-earnings";
import { extractArrayFromUnusualWhalesResponse } from "./unusual-whales-dark-pool";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const UW_INSIDER_TRADES_URL = "https://phx.unusualwhales.com/api/insider_trades/feed?transaction_codes[]=P&transaction_codes[]=S&limit=500&min_value=500000&min_marketcap=500000000&common_stock_only=true&max_marketcap=20000000000&min_earnings_dte=7&max_earnings_dte=60&min_price=5&min_amount=25000&is_director=true&exclude_10b5_1=true&group=true";
const SOURCE = "unusual_whales_insider_trades";
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v): v is string => typeof v === "string" && !!v.trim())?.trim() ?? null;
const num = (v: unknown) => typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" && v.trim() ? Number(v.replace(/[$,% ,]/g, "")) || null : null;
const cutoffDate = () => new Date(Date.now() - 92 * 86400_000).toISOString().slice(0, 10);
const safeKeys = (value: unknown, limit = 20) => isRec(value) ? Object.keys(value).slice(0, limit) : [];

function providerId(r: Rec) {
  return str(r, ["id", "external_id", "transaction_id", "filing_id", "accession_number", "accessionNo", "uuid"]);
}

export function dedupeByExternalId<Row extends { externalId: string }>(rows: Row[]): { rows: Row[]; duplicatesRemoved: number; duplicateIds: string[] } {
  const seen = new Map<string, Row>();
  const duplicateIds: string[] = [];
  for (const row of rows) {
    const existing = seen.get(row.externalId);
    if (!existing) { seen.set(row.externalId, row); continue; }
    if (duplicateIds.length < 10 && !duplicateIds.includes(row.externalId)) duplicateIds.push(row.externalId);
  }
  return { rows: [...seen.values()], duplicatesRemoved: rows.length - seen.size, duplicateIds };
}

export function normalizeInsiderTradesPayload(payload: unknown, fetchedAt = new Date().toISOString()): { rows: InsiderTradeRow[]; fetched: number; rawCount: number; normalizedBeforeDateFilter: number; filteredOutOld: number; normalizedAfterDateFilter: number; skipped: number; responsePath: string | null; emptyReason?: string } {
  const cutoff = cutoffDate();
  const extracted = extractArrayFromUnusualWhalesResponse(payload);
  let filteredOutOld = 0;
  let skipped = 0;
  const beforeDate: InsiderTradeRow[] = [];
  for (const value of extracted.rows) {
    if (!isRec(value)) { skipped += 1; continue; }
    const ticker = str(value, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
    const transactionDate = str(value, ["transaction_date", "transactionDate", "date", "filing_date", "filed_at"]);
    const code = str(value, ["transaction_code", "transactionCode", "code", "transaction_type"])?.toUpperCase();
    if (!ticker || !transactionDate || (code !== "P" && code !== "S")) { skipped += 1; continue; }
    const date = transactionDate.slice(0, 10);
    const absAmount = Math.abs(num(value.amount ?? value.shares ?? value.share_amount ?? value.transaction_shares) ?? 0);
    const amount = code === "S" ? -absAmount : absAmount;
    const price = num(value.price ?? value.transaction_price);
    const ownerName = str(value, ["owner_name", "ownerName", "insider_name", "name", "reporting_owner"]);
    const officerTitle = str(value, ["officer_title", "officerTitle", "title", "relationship"]);
    const sharesOwnedAfter = num(value.shares_owned_after ?? value.sharesOwnedAfter ?? value.owned_after);
    const suppliedId = providerId(value);
    const externalId = suppliedId ? `uw:${suppliedId}` : stableHash({ ticker, transactionDate: date, ownerName, officerTitle, transactionCode: code, amount, price, sharesOwnedAfter });
    beforeDate.push({ externalId, ticker, sector: str(value, ["sector", "stock_sector"]), amount, transactionDate: date, price, ownerName, officerTitle, transactionCode: code as "P" | "S", sharesOwnedAfter, fetchedAt });
  }
  const rows = beforeDate.filter((row) => {
    if (row.transactionDate < cutoff) { filteredOutOld += 1; return false; }
    return true;
  });
  const emptyReason = extracted.rows.length === 0 ? extracted.reason : rows.length === 0 ? (beforeDate.length ? "all_rows_outside_past_3_months" : "all_rows_skipped") : undefined;
  return { rows, fetched: extracted.rows.length, rawCount: extracted.rows.length, normalizedBeforeDateFilter: beforeDate.length, filteredOutOld, normalizedAfterDateFilter: rows.length, skipped, responsePath: extracted.path, emptyReason };
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
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(UW_INSIDER_TRADES_URL, { headers: { accept: "application/json" } });
    const fetchDiagnostics = { status: res.status, ok: res.ok, contentType: res.headers.get("content-type") };
    if (!res.ok) throw new Error(`Unusual Whales insider fetch failed: ${res.status}`);
    const payload = await res.json();
    const normalized = normalizeInsiderTradesPayload(payload, fetchedAt);
    console.log("insider_trades_response_diagnostics", { ...fetchDiagnostics, topLevelKeys: safeKeys(payload), responseKind: Array.isArray(payload) ? "array" : isRec(payload) ? "object" : typeof payload, responsePath: normalized.responsePath, rawCount: normalized.rawCount, normalizedBeforeDateFilter: normalized.normalizedBeforeDateFilter, filteredOutOld: normalized.filteredOutOld, normalizedAfterDateFilter: normalized.normalizedAfterDateFilter, skipped: normalized.skipped, firstItemKeys: safeKeys(extractArrayFromUnusualWhalesResponse(payload).rows[0]) });
    if (!normalized.responsePath) throw new Error(normalized.emptyReason?.startsWith("provider_message:") ? `Unusual Whales insider response did not include rows: ${normalized.emptyReason}` : "Unable to locate insider trade rows in Unusual Whales response");
    const deduped = dedupeByExternalId(normalized.rows);
    if (deduped.duplicatesRemoved) console.warn("insider_trades_duplicate_external_ids_removed", { duplicatesRemoved: deduped.duplicatesRemoved, duplicateIds: deduped.duplicateIds });
    const dbRows = deduped.rows.map((r) => ({ external_id: r.externalId, ticker: r.ticker, sector: r.sector, amount: r.amount, transaction_date: r.transactionDate, price: r.price, owner_name: r.ownerName, officer_title: r.officerTitle, transaction_code: r.transactionCode, shares_owned_after: r.sharesOwnedAfter, fetched_at: r.fetchedAt, updated_at: fetchedAt }));
    if (dbRows.length) {
      const { error } = await supabase.client.from("unusual_whales_insider_trades").upsert(dbRows, { onConflict: "external_id" });
      if (error) throw new Error(`Insider trades upsert failed: ${error.message}`);
    }
    const contentHash = payloadContentHash(deduped.rows);
    const meta = { fetched: normalized.fetched, rawCount: normalized.rawCount, normalizedBeforeDateFilter: normalized.normalizedBeforeDateFilter, filteredOutOld: normalized.filteredOutOld, normalizedAfterDateFilter: normalized.normalizedAfterDateFilter, skipped: normalized.skipped, duplicatesRemoved: deduped.duplicatesRemoved, duplicateIds: deduped.duplicateIds, upserted: dbRows.length, responsePath: normalized.responsePath, emptyReason: normalized.emptyReason, window: "past_3_months", fetch: fetchDiagnostics };
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: true, changed: true, rowCount: deduped.rows.length, contentHash, meta });
    return sourceResult({ ok: true, count: deduped.rows.length, changed: true, contentHash, upserted: dbRows.length, meta });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown insider refresh error";
    await updateRefreshMetadata(supabase.client, SOURCE, { ok: false, changed: null, rowCount: 0, error: message }).catch(() => undefined);
    return sourceResult({ ok: false, count: 0, error: message });
  }
}
