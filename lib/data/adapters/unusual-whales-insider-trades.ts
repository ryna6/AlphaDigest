import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { InsiderTradeRow } from "@/lib/data/schemas/dashboard";
import { stableHash } from "./unusual-whales-earnings";
import { extractArrayFromUnusualWhalesResponse } from "./unusual-whales-dark-pool";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";
import { getInsiderWindowStartDate, INSIDER_TRADES_LOOKBACK_MONTHS } from "../insider-window";

export const UW_INSIDER_TRADES_URL =
  "https://phx.unusualwhales.com/api/insider_trades/feed?transaction_codes[]=P&transaction_codes[]=S&limit=500&min_value=500000&min_marketcap=500000000&common_stock_only=true&max_marketcap=20000000000&min_earnings_dte=7&max_earnings_dte=60&min_price=5&min_amount=25000&is_director=true&exclude_10b5_1=true&group=true";
const INSIDER_PAGES = [0, 1, 2, 3] as const;
const SOURCE = "unusual_whales_insider_trades";
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) =>
  keys
    .map((k) => r[k])
    .find((v): v is string => typeof v === "string" && !!v.trim())
    ?.trim() ?? null;
const num = (v: unknown) =>
  typeof v === "number"
    ? Number.isFinite(v)
      ? v
      : null
    : typeof v === "string" && v.trim()
      ? Number(v.replace(/[$,% ,]/g, "")) || null
      : null;
const cutoffDate = () => getInsiderWindowStartDate();
const safeKeys = (value: unknown, limit = 20) =>
  isRec(value) ? Object.keys(value).slice(0, limit) : [];

function providerId(r: Rec) {
  return str(r, [
    "id",
    "external_id",
    "transaction_id",
    "filing_id",
    "accession_number",
    "accessionNo",
    "uuid"
  ]);
}

export function dedupeByExternalId<Row extends { externalId: string }>(
  rows: Row[]
): { rows: Row[]; duplicatesRemoved: number; duplicateIds: string[] } {
  const seen = new Map<string, Row>();
  const duplicateIds: string[] = [];
  for (const row of rows) {
    const existing = seen.get(row.externalId);
    if (!existing) {
      seen.set(row.externalId, row);
      continue;
    }
    if (duplicateIds.length < 10 && !duplicateIds.includes(row.externalId))
      duplicateIds.push(row.externalId);
  }
  return { rows: [...seen.values()], duplicatesRemoved: rows.length - seen.size, duplicateIds };
}

export function normalizeInsiderTradesPayload(
  payload: unknown,
  fetchedAt = new Date().toISOString()
): {
  rows: InsiderTradeRow[];
  fetched: number;
  rawCount: number;
  normalizedBeforeDateFilter: number;
  filteredOutOld: number;
  normalizedAfterDateFilter: number;
  skipped: number;
  responsePath: string | null;
  emptyReason?: string;
} {
  const cutoff = cutoffDate();
  const extracted = extractArrayFromUnusualWhalesResponse(payload);
  let filteredOutOld = 0;
  let skipped = 0;
  const beforeDate: InsiderTradeRow[] = [];
  for (const value of extracted.rows) {
    if (!isRec(value)) {
      skipped += 1;
      continue;
    }
    const ticker = str(value, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
    const transactionDate = str(value, [
      "transaction_date",
      "transactionDate",
      "date",
      "filing_date",
      "filed_at"
    ]);
    const code = str(value, [
      "transaction_code",
      "transactionCode",
      "code",
      "transaction_type"
    ])?.toUpperCase();
    if (!ticker || !transactionDate || (code !== "P" && code !== "S")) {
      skipped += 1;
      continue;
    }
    const date = transactionDate.slice(0, 10);
    const absAmount = Math.abs(
      num(value.amount ?? value.shares ?? value.share_amount ?? value.transaction_shares) ?? 0
    );
    const amount = code === "S" ? -absAmount : absAmount;
    const price = num(value.price ?? value.transaction_price);
    const ownerName = str(value, [
      "owner_name",
      "ownerName",
      "insider_name",
      "name",
      "reporting_owner"
    ]);
    const officerTitle = str(value, ["officer_title", "officerTitle", "title", "relationship"]);
    const sharesOwnedAfter = num(
      value.shares_owned_after ?? value.sharesOwnedAfter ?? value.owned_after
    );
    const suppliedId = providerId(value);
    const externalId = suppliedId
      ? `uw:${suppliedId}`
      : stableHash({
          ticker,
          transactionDate: date,
          ownerName,
          officerTitle,
          transactionCode: code,
          amount,
          price,
          sharesOwnedAfter
        });
    beforeDate.push({
      externalId,
      ticker,
      sector: str(value, ["sector", "stock_sector"]),
      amount,
      transactionDate: date,
      price,
      ownerName,
      officerTitle,
      transactionCode: code as "P" | "S",
      sharesOwnedAfter,
      fetchedAt
    });
  }
  const rows = beforeDate.filter((row) => {
    if (row.transactionDate < cutoff) {
      filteredOutOld += 1;
      return false;
    }
    return true;
  });
  const emptyReason =
    extracted.rows.length === 0
      ? extracted.reason
      : rows.length === 0
        ? beforeDate.length
          ? "all_rows_outside_6_month_window"
          : "all_rows_skipped"
        : undefined;
  return {
    rows,
    fetched: extracted.rows.length,
    rawCount: extracted.rows.length,
    normalizedBeforeDateFilter: beforeDate.length,
    filteredOutOld,
    normalizedAfterDateFilter: rows.length,
    skipped,
    responsePath: extracted.path,
    emptyReason
  };
}

const INSIDER_READ_PAGE_SIZE = 1000;
const INSIDER_MAX_SOURCE_ROWS = 5000;

function mapInsiderRows(data: any[]) {
  return (data ?? []).map((r: any) => ({
    externalId: r.external_id,
    ticker: r.ticker,
    sector: r.sector,
    amount: Number(r.amount ?? 0),
    transactionDate: r.transaction_date,
    price: r.price == null ? null : Number(r.price),
    ownerName: r.owner_name,
    officerTitle: r.officer_title,
    transactionCode: r.transaction_code,
    sharesOwnedAfter: r.shares_owned_after == null ? null : Number(r.shares_owned_after),
    fetchedAt: r.fetched_at
  })) satisfies InsiderTradeRow[];
}

export async function readInsiderTradeRows(
  client: SupabaseClient,
  ticker?: string,
  limit = INSIDER_MAX_SOURCE_ROWS
) {
  const cutoff = cutoffDate();
  const rows: any[] = [];
  const requestedLimit = Math.max(0, limit);

  for (let from = 0; from < requestedLimit; from += INSIDER_READ_PAGE_SIZE) {
    const to = Math.min(from + INSIDER_READ_PAGE_SIZE - 1, requestedLimit - 1);
    let q = client
      .from("unusual_whales_insider_trades")
      .select(
        "external_id,ticker,sector,amount,transaction_date,price,owner_name,officer_title,transaction_code,shares_owned_after,fetched_at"
      )
      .gte("transaction_date", cutoff)
      .order("transaction_date", { ascending: false })
      .range(from, to);
    if (ticker) q = q.eq("ticker", ticker.toUpperCase());
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < to - from + 1) break;
  }

  return mapInsiderRows(rows);
}

function insiderTradesUrlForPage(page: number) {
  // Unusual Whales treats page=0 the same as omitting page; include page explicitly so logs,
  // metadata, and retries consistently describe the four requested pages (0 through 3).
  const url = new URL(UW_INSIDER_TRADES_URL);
  url.searchParams.set("page", String(page));
  return url.toString();
}

export async function refreshInsiderTrades() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message });
  const fetchedAt = new Date().toISOString();
  const pageResults: Array<{
    page: number;
    status: number | null;
    ok: boolean;
    rawCount: number;
    normalizedCount: number;
    filteredCount: number;
    error?: string;
    responsePath?: string | null;
    skipped?: number;
    filteredOutOld?: number;
  }> = [];
  try {
    const allRows: InsiderTradeRow[] = [];
    for (const page of INSIDER_PAGES) {
      let status: number | null = null;
      try {
        const res = await fetch(insiderTradesUrlForPage(page), {
          headers: { accept: "application/json" }
        });
        status = res.status;
        const fetchDiagnostics = {
          page,
          status: res.status,
          ok: res.ok,
          contentType: res.headers.get("content-type")
        };
        if (!res.ok)
          throw new Error(`Unusual Whales insider fetch failed for page ${page}: ${res.status}`);
        const payload = await res.json();
        const normalized = normalizeInsiderTradesPayload(payload, fetchedAt);
        console.log("insider_trades_page_diagnostics", {
          ...fetchDiagnostics,
          lookbackMonths: INSIDER_TRADES_LOOKBACK_MONTHS,
          rawCount: normalized.rawCount,
          normalizedCount: normalized.normalizedBeforeDateFilter,
          filteredCount: normalized.normalizedAfterDateFilter,
          filteredOutOld: normalized.filteredOutOld,
          skipped: normalized.skipped,
          responsePath: normalized.responsePath,
          firstItemKeys: safeKeys(extractArrayFromUnusualWhalesResponse(payload).rows[0])
        });
        if (!normalized.responsePath)
          throw new Error(
            normalized.emptyReason?.startsWith("provider_message:")
              ? `Unusual Whales insider response did not include rows on page ${page}: ${normalized.emptyReason}`
              : `Unable to locate insider trade rows in Unusual Whales response on page ${page}`
          );
        pageResults.push({
          page,
          status: res.status,
          ok: true,
          rawCount: normalized.rawCount,
          normalizedCount: normalized.normalizedBeforeDateFilter,
          filteredCount: normalized.normalizedAfterDateFilter,
          responsePath: normalized.responsePath,
          skipped: normalized.skipped,
          filteredOutOld: normalized.filteredOutOld
        });
        allRows.push(...normalized.rows);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Unknown insider page ${page} error`;
        pageResults.push({
          page,
          status,
          ok: false,
          rawCount: 0,
          normalizedCount: 0,
          filteredCount: 0,
          error: message
        });
        console.error("insider_trades_page_failed", {
          page,
          error: message,
          lookbackMonths: INSIDER_TRADES_LOOKBACK_MONTHS
        });
        if (page === 0) throw error;
        break;
      }
    }

    const failedPages = pageResults.filter((p) => !p.ok).map((p) => p.page);
    const succeededPages = pageResults.filter((p) => p.ok).map((p) => p.page);
    const partialWarning = failedPages.length
      ? `Partial insider refresh: persisted pages ${succeededPages.join(", ")} only; failed pages ${failedPages.join(", ")}.`
      : null;
    const deduped = dedupeByExternalId(allRows);
    if (deduped.duplicatesRemoved)
      console.warn("insider_trades_duplicate_external_ids_removed", {
        duplicatesRemoved: deduped.duplicatesRemoved,
        duplicateIds: deduped.duplicateIds
      });
    const dbRows = deduped.rows.map((r) => ({
      external_id: r.externalId,
      ticker: r.ticker,
      sector: r.sector,
      amount: r.amount,
      transaction_date: r.transactionDate,
      price: r.price,
      owner_name: r.ownerName,
      officer_title: r.officerTitle,
      transaction_code: r.transactionCode,
      shares_owned_after: r.sharesOwnedAfter,
      fetched_at: r.fetchedAt,
      updated_at: fetchedAt
    }));
    if (dbRows.length) {
      const { error } = await supabase.client
        .from("unusual_whales_insider_trades")
        .upsert(dbRows, { onConflict: "external_id" });
      if (error) throw new Error(`Insider trades upsert failed: ${error.message}`);
    }
    const pruneCutoff = cutoffDate();
    const { count: pruned, error: pruneError } = await supabase.client
      .from("unusual_whales_insider_trades")
      .delete({ count: "exact" })
      .lt("transaction_date", pruneCutoff);
    if (pruneError) throw new Error(`Insider trades prune failed: ${pruneError.message}`);
    const contentHash = payloadContentHash(deduped.rows);
    const meta = {
      pagesAttempted: pageResults.map((p) => p.page),
      pagesSucceeded: succeededPages,
      pagesFailed: failedPages,
      pageCounts: pageResults,
      totalRawCount: pageResults.reduce((sum, p) => sum + p.rawCount, 0),
      normalizedCount: pageResults.reduce((sum, p) => sum + p.normalizedCount, 0),
      filteredToLookbackCount: pageResults.reduce((sum, p) => sum + p.filteredCount, 0),
      lookbackMonths: INSIDER_TRADES_LOOKBACK_MONTHS,
      duplicatesRemoved: deduped.duplicatesRemoved,
      duplicateIds: deduped.duplicateIds,
      upserted: dbRows.length,
      pruned: pruned ?? 0,
      pruneCutoff,
      contentHash,
      partialWarning,
      window: "past_6_months"
    };
    if (partialWarning) console.warn("insider_trades_partial_refresh", meta);
    await updateRefreshMetadata(supabase.client, SOURCE, {
      ok: failedPages.length === 0,
      changed: true,
      rowCount: deduped.rows.length,
      contentHash,
      error: partialWarning ?? undefined,
      meta
    });
    return sourceResult({
      ok: failedPages.length === 0,
      count: deduped.rows.length,
      changed: true,
      contentHash,
      upserted: dbRows.length,
      error: partialWarning ?? undefined,
      meta
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown insider refresh error";
    await updateRefreshMetadata(supabase.client, SOURCE, {
      ok: false,
      changed: null,
      rowCount: 0,
      error: message,
      meta: {
        lookbackMonths: INSIDER_TRADES_LOOKBACK_MONTHS,
        pagesAttempted: pageResults.map((p) => p.page),
        pagesSucceeded: pageResults.filter((p) => p.ok).map((p) => p.page),
        pagesFailed: pageResults.filter((p) => !p.ok).map((p) => p.page),
        pageCounts: pageResults
      }
    }).catch(() => undefined);
    return sourceResult({
      ok: false,
      count: 0,
      error: message,
      meta: {
        lookbackMonths: INSIDER_TRADES_LOOKBACK_MONTHS,
        pagesAttempted: pageResults.map((p) => p.page),
        pagesFailed: pageResults.filter((p) => !p.ok).map((p) => p.page),
        pageCounts: pageResults
      }
    });
  }
}
