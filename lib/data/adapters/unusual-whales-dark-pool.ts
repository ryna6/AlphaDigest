import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { DarkPoolFlowRow } from "@/lib/data/schemas/dashboard";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

export const UW_DARK_POOL_URL =
  "https://phx.unusualwhales.com/api/flow/dark-pool?tab=dark-pool&limit=250&min_premium=10000000&min_marketcap=5000000000&min_size_avg30d_vol_perc=0.05&min_size_daily_perc=0.15&min_size=250000&min_price=5&order=Prem&hide_index_etf=true&max_marketcap=100000000000&max_size_daily_perc=0.5&max_size_avg30d_vol_perc=0.25";
export const DARK_POOL_RETENTION_DAYS = 30;
const SOURCE = "unusual_whales_dark_pool_flows";

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
const safeKeys = (value: unknown, limit = 20) =>
  isRec(value) ? Object.keys(value).slice(0, limit) : [];

const canonicalDarkPoolKey = (row: Pick<DarkPoolFlowRow, "ticker" | "executedAt" | "price" | "premium">) =>
  stableHash({ ticker: row.ticker, executedAt: row.executedAt, price: row.price, premium: row.premium });

export function extractArrayFromUnusualWhalesResponse(json: unknown): {
  rows: unknown[];
  path: string | null;
  reason?: string;
} {
  if (Array.isArray(json)) return { rows: json, path: "$" };
  if (!isRec(json)) return { rows: [], path: null, reason: "response_is_not_object_or_array" };
  const paths: Array<[string, unknown]> = [
    ["data", json.data],
    ["trades", json.trades],
    ["results", json.results],
    ["rows", json.rows],
    ["items", json.items]
  ];
  if (isRec(json.data))
    paths.push(
      ["data.rows", json.data.rows],
      ["data.items", json.data.items],
      ["data.results", json.data.results],
      ["data.trades", json.data.trades]
    );
  for (const [path, value] of paths) {
    if (Array.isArray(value))
      return {
        rows: value,
        path,
        reason: value.length ? undefined : "provider_returned_empty_array"
      };
  }
  const message = str(json, ["error", "message", "detail", "reason"]);
  return {
    rows: [],
    path: null,
    reason: message ? `provider_message:${message.slice(0, 120)}` : "no_supported_array_path"
  };
}

export function normalizeDarkPoolPayload(
  payload: unknown,
  fetchedAt = new Date().toISOString()
): {
  rows: DarkPoolFlowRow[];
  rawCount: number;
  skipped: number;
  skipReasons: Record<string, number>;
  responsePath: string | null;
  emptyReason?: string;
} {
  const extracted = extractArrayFromUnusualWhalesResponse(payload);
  const skipReasons: Record<string, number> = {};
  const skip = (reason: string) => {
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  };
  const rows = extracted.rows
    .map((value) => {
      if (!isRec(value)) {
        skip("non_object_row");
        return null;
      }
      const ticker = str(value, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
      const executedAtRaw = str(value, [
        "executed_at",
        "executedAt",
        "timestamp",
        "time",
        "created_at"
      ]);
      if (!ticker) {
        skip("missing_ticker");
        return null;
      }
      if (!executedAtRaw) {
        skip("missing_executed_at");
        return null;
      }
      const executedAt = new Date(executedAtRaw);
      if (Number.isNaN(executedAt.getTime())) {
        skip("invalid_executed_at");
        return null;
      }
      const price = num(value.price ?? value.spot ?? value.underlying_price);
      const premium = num(value.premium ?? value.prem ?? value.notional ?? value.value);
      const volume = num(value.volume ?? value.vol);
      const size = num(value.size ?? value.Size ?? value.trade_size ?? value.total_size);
      const avg30Volume = num(value.avg30_volume ?? value.avg30Volume ?? value.avg_30_volume ?? value.avg_30_day_volume ?? value.avg30_day_volume);
      return {
        externalId: canonicalDarkPoolKey({
          ticker,
          executedAt: executedAt.toISOString(),
          price,
          premium
        }),
        executedAt: executedAt.toISOString(),
        ticker,
        sector: str(value, ["sector", "stock_sector"]),
        price,
        premium,
        size,
        volume,
        avg30Volume,
        fetchedAt
      };
    })
    .filter(Boolean) as DarkPoolFlowRow[];
  const emptyReason =
    extracted.rows.length === 0
      ? extracted.reason
      : rows.length === 0
        ? "all_rows_skipped"
        : undefined;
  return {
    rows,
    rawCount: extracted.rows.length,
    skipped: extracted.rows.length - rows.length,
    skipReasons,
    responsePath: extracted.path,
    emptyReason
  };
}

export async function readDarkPoolRows(client: SupabaseClient, limit = 50, ticker?: string) {
  let query = client
    .from("unusual_whales_dark_pool_flows")
    .select("external_id,executed_at,ticker,sector,price,premium,size,volume,avg30_volume,fetched_at")
    .order(ticker ? "executed_at" : "premium", { ascending: false })
    .limit(limit);
  if (ticker) query = query.eq("ticker", ticker.toUpperCase());
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    externalId: r.external_id,
    executedAt: r.executed_at,
    ticker: r.ticker,
    sector: r.sector,
    price: r.price == null ? null : Number(r.price),
    premium: r.premium == null ? null : Number(r.premium),
    size: r.size == null ? null : Number(r.size),
    volume: r.volume == null ? null : Number(r.volume),
    avg30Volume: r.avg30_volume == null ? null : Number(r.avg30_volume),
    fetchedAt: r.fetched_at
  })) satisfies DarkPoolFlowRow[];
}

export async function refreshDarkPoolFlows() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return sourceResult({ ok: false, count: 0, error: supabase.message });
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(UW_DARK_POOL_URL, { headers: { accept: "application/json" } });
    const fetchDiagnostics = {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type")
    };
    if (!res.ok) throw new Error(`Unusual Whales dark pool fetch failed: ${res.status}`);
    const payload = await res.json();
    const normalized = normalizeDarkPoolPayload(payload, fetchedAt);
    const shapeDiagnostics = {
      ...fetchDiagnostics,
      topLevelKeys: safeKeys(payload),
      responseKind: Array.isArray(payload) ? "array" : isRec(payload) ? "object" : typeof payload,
      responsePath: normalized.responsePath,
      rawCount: normalized.rawCount,
      normalized: normalized.rows.length,
      skipped: normalized.skipped,
      skipReasons: normalized.skipReasons,
      firstItemKeys: safeKeys(extractArrayFromUnusualWhalesResponse(payload).rows[0]),
      rowsWithSize: normalized.rows.filter((row) => row.size != null).length,
      rowsMissingSize: normalized.rows.filter((row) => row.size == null).length,
      rowsWithAvg30Volume: normalized.rows.filter((row) => row.avg30Volume != null).length,
      rowsMissingAvg30Volume: normalized.rows.filter((row) => row.avg30Volume == null).length,
      missingFieldSamples: normalized.rows
        .filter((row) => row.size == null || row.avg30Volume == null)
        .slice(0, 10)
        .map((row) => ({ ticker: row.ticker, executedAt: row.executedAt, missingSize: row.size == null, missingAvg30Volume: row.avg30Volume == null }))
    };
    console.log("dark_pool_response_diagnostics", shapeDiagnostics);
    if (!normalized.responsePath)
      throw new Error(
        normalized.emptyReason?.startsWith("provider_message:")
          ? `Unusual Whales dark pool response did not include rows: ${normalized.emptyReason}`
          : "Unable to locate dark pool rows in Unusual Whales response"
      );
    let reusedExistingExternalIds = 0;
    if (normalized.rows.length) {
      const times = normalized.rows.map((row) => row.executedAt).sort();
      const { data: existingRows, error: existingError } = await supabase.client
        .from("unusual_whales_dark_pool_flows")
        .select("external_id,executed_at,ticker,price,premium")
        .gte("executed_at", times[0])
        .lte("executed_at", times[times.length - 1]);
      if (existingError) throw new Error(`Dark pool existing-row lookup failed: ${existingError.message}`);
      const existingIdByCanonicalKey = new Map(
        (existingRows ?? []).map((row: any) => [
          canonicalDarkPoolKey({
            ticker: String(row.ticker ?? "").toUpperCase(),
            executedAt: row.executed_at,
            price: row.price == null ? null : Number(row.price),
            premium: row.premium == null ? null : Number(row.premium)
          }),
          row.external_id as string
        ])
      );
      for (const row of normalized.rows) {
        const existingId = existingIdByCanonicalKey.get(canonicalDarkPoolKey(row));
        if (existingId && existingId !== row.externalId) {
          row.externalId = existingId;
          reusedExistingExternalIds += 1;
        }
      }
    }
    const dbRows = normalized.rows.map((r) => ({
      external_id: r.externalId,
      executed_at: r.executedAt,
      ticker: r.ticker,
      sector: r.sector,
      price: r.price,
      premium: r.premium,
      size: r.size,
      volume: r.volume,
      avg30_volume: r.avg30Volume,
      fetched_at: r.fetchedAt,
      updated_at: fetchedAt
    }));
    if (dbRows.length) {
      const { error } = await supabase.client
        .from("unusual_whales_dark_pool_flows")
        .upsert(dbRows, { onConflict: "external_id" });
      if (error) throw new Error(`Dark pool upsert failed: ${error.message}`);
    }
    const cutoff = new Date(Date.now() - DARK_POOL_RETENTION_DAYS * 86400_000).toISOString();
    const { count: pruned, error: pruneError } = await supabase.client
      .from("unusual_whales_dark_pool_flows")
      .delete({ count: "exact" })
      .lt("executed_at", cutoff);
    if (pruneError) throw new Error(`Dark pool prune failed: ${pruneError.message}`);
    const ok = !(normalized.rawCount > 0 && normalized.rows.length === 0);
    const error = ok
      ? null
      : "Dark pool response contained rows, but none had required ticker/executed_at fields";
    const contentHash = payloadContentHash(normalized.rows);
    const meta = {
      fetched: normalized.rawCount,
      rawCount: normalized.rawCount,
      normalized: normalized.rows.length,
      skipped: normalized.skipped,
      skipReasons: normalized.skipReasons,
      upserted: dbRows.length,
      reusedExistingExternalIds,
      pruned: pruned ?? 0,
      responsePath: normalized.responsePath,
      emptyReason: normalized.emptyReason,
      rowsWithSize: shapeDiagnostics.rowsWithSize,
      rowsMissingSize: shapeDiagnostics.rowsMissingSize,
      rowsWithAvg30Volume: shapeDiagnostics.rowsWithAvg30Volume,
      rowsMissingAvg30Volume: shapeDiagnostics.rowsMissingAvg30Volume,
      missingFieldSamples: shapeDiagnostics.missingFieldSamples,
      retentionDays: DARK_POOL_RETENTION_DAYS,
      fetch: fetchDiagnostics
    };
    await updateRefreshMetadata(supabase.client, SOURCE, {
      ok,
      changed: true,
      rowCount: normalized.rows.length,
      contentHash,
      error,
      meta
    });
    return sourceResult({
      ok,
      count: normalized.rows.length,
      changed: true,
      error,
      contentHash,
      upserted: dbRows.length,
      meta
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown dark pool refresh error";
    await updateRefreshMetadata(supabase.client, SOURCE, {
      ok: false,
      changed: null,
      rowCount: 0,
      error: message
    }).catch(() => undefined);
    return sourceResult({ ok: false, count: 0, error: message });
  }
}
