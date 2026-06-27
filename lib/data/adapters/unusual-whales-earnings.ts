import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";

const UW_EARNINGS_URL = "https://phx.unusualwhales.com/api/companies_earnings/upcoming_earnings_v2";
const SOURCE = "unusual_whales_earnings";
const DEFAULT_LIMIT = 250;
const UW_EARNINGS_MIN_MARKET_CAP = 4_000_000_000;
const UW_EARNINGS_COUNTRY_CODE = "US";
const REQUEST_TIMEOUT_MS = 15_000;
const SERVER_CACHE_TTL_MS = 60_000;

let liveServerCache: { key: string; expiresAt: number; result: CachedEarningsResult } | null = null;

type UnknownRecord = Record<string, unknown>;

export type UnusualWhalesEarningsEvent = {
  source: "unusual_whales_earnings";
  id: string;
  symbol: string;
  companyName: string | null;
  logo: string | null;
  reportDate: string;
  reportTime: "premarket" | "postmarket" | "regular" | string | null;
  marketTime: string | null;
  sector: string | null;
  isSp500: boolean;
  marketCapSize: string | null;
  marketCap: number | null;
  callVolume: number | null;
  putVolume: number | null;
  expectedMove: number | null;
  impliedMove: number | null;
  impliedMovePct: number | null;
  raw: Record<string, unknown>;
  contentHash: string;
  fetchedAt: string;
};

export type EarningsRange = { minDate: string; maxDate: string };
export type EarningsMetadata = {
  source: string;
  ok: boolean;
  fetchedAt: string;
  changed: boolean | null;
  rowCount: number | null;
  contentHash: string | null;
  error: string | null;
  meta: Record<string, unknown> | null;
};

type CachedEarningsResult = {
  events: UnusualWhalesEarningsEvent[];
  metadata: EarningsMetadata | null;
  mode: "supabase" | "live" | "fallback" | "unavailable";
  message?: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateImpliedMovePct({
  impliedMove,
  expectedMove,
  currentPrice,
  previousPrice
}: {
  impliedMove: number | null;
  expectedMove: number | null;
  currentPrice: number | null;
  previousPrice: number | null;
}) {
  const move = impliedMove ?? expectedMove;
  const price = currentPrice ?? previousPrice;
  return move !== null && price !== null && price > 0 ? (move / price) * 100 : null;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function stableHash(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function defaultEarningsRange(date = new Date()): EarningsRange {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 3)
  );
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 14));
  return { minDate: start.toISOString().slice(0, 10), maxDate: end.toISOString().slice(0, 10) };
}

export function normalizeUnusualWhalesEarningsRows(
  rows: unknown[],
  fetchedAt = new Date().toISOString()
) {
  const normalized = rows.map((row) => normalizeUnusualWhalesEarningsRow(row, fetchedAt));
  const skippedMicroCount = normalized.filter(
    (event) => event?.marketCapSize?.trim().toLowerCase() === "micro"
  ).length;
  const events = normalized.filter(
    (event): event is UnusualWhalesEarningsEvent =>
      event !== null && (event.marketCapSize?.trim().toLowerCase() ?? "") !== "micro"
  );
  const deduped = new Map<string, UnusualWhalesEarningsEvent>();
  for (const event of events) deduped.set(event.id, event);
  const result = suppressUnknownEarningsVariants(Array.from(deduped.values())).sort((a, b) =>
    a.id.localeCompare(b.id)
  );
  Object.defineProperty(result, "skippedMicroCount", {
    value: skippedMicroCount,
    enumerable: false
  });
  return result;
}

function isUnknownEarningsVariant(event: UnusualWhalesEarningsEvent) {
  return !event.reportTime || event.id.endsWith(":unknown");
}

export function suppressUnknownEarningsVariants(events: UnusualWhalesEarningsEvent[]) {
  const symbolsWithDatedRows = new Set(
    events
      .filter((event) => !isUnknownEarningsVariant(event))
      .map((event) => event.symbol.toUpperCase())
  );
  return events.filter(
    (event) =>
      !isUnknownEarningsVariant(event) || !symbolsWithDatedRows.has(event.symbol.toUpperCase())
  );
}

export function normalizeUnusualWhalesEarningsRow(
  row: unknown,
  fetchedAt = new Date().toISOString()
) {
  if (!isRecord(row)) return null;
  const symbol = stringOrNull(row.symbol)?.toUpperCase();
  const reportDate = stringOrNull(row.report_date);
  if (!symbol || !reportDate) return null;
  const reportTime = stringOrNull(row.report_time);
  const id = `uw-earnings:${symbol}:${reportDate}:${reportTime ?? "unknown"}`;
  const impliedMove = numberOrNull(row.implied_move);
  const expectedMove = numberOrNull(row.expected_move);
  const currentPrice = numberOrNull(row.curr);
  const previousPrice = numberOrNull(row.prev);
  const impliedMovePct = calculateImpliedMovePct({
    impliedMove,
    expectedMove,
    currentPrice,
    previousPrice
  });
  const base = {
    source: "unusual_whales_earnings" as const,
    id,
    symbol,
    companyName: stringOrNull(row.full_name),
    logo: stringOrNull(row.logo),
    reportDate,
    reportTime,
    marketTime: stringOrNull(row.market_time),
    sector: stringOrNull(row.sector),
    isSp500: booleanValue(row.is_s_p_500),
    marketCapSize: stringOrNull(row.market_cap_size),
    marketCap: numberOrNull(row.marketcap),
    callVolume: numberOrNull(row.call_vol),
    putVolume: numberOrNull(row.put_vol),
    expectedMove,
    impliedMove,
    impliedMovePct,
    raw: row
  };
  return { ...base, contentHash: stableHash(base), fetchedAt };
}

export function payloadHash(events: UnusualWhalesEarningsEvent[]) {
  return stableHash(events.map(({ fetchedAt: _fetchedAt, ...event }) => event));
}

export function buildUnusualWhalesEarningsUrl(range: EarningsRange) {
  const url = new URL(UW_EARNINGS_URL);
  url.searchParams.set("formats", "table");
  url.searchParams.set("min_date", range.minDate);
  url.searchParams.set("max_date", range.maxDate);
  url.searchParams.set("order", "oi");
  url.searchParams.set("order_direction", "desc");
  url.searchParams.set("min_marketcap", String(UW_EARNINGS_MIN_MARKET_CAP));
  url.searchParams.append("country_codes[]", UW_EARNINGS_COUNTRY_CODE);
  return url.toString();
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) throw new Error("Unexpected Unusual Whales earnings response shape.");
  for (const key of ["data", "results", "rows"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.data)) return value.data;
  }
  throw new Error("Unusual Whales earnings response did not contain an array of rows.");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json,text/plain,*/*" },
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchUnusualWhalesEarnings(range = defaultEarningsRange()) {
  const endpoint = buildUnusualWhalesEarningsUrl(range);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(endpoint);
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new Error(
          `Unusual Whales earnings request failed with ${response.status} for ${endpoint}.`
        );
      }
      const payload = (await response.json()) as unknown;
      const rows = extractRows(payload);
      const events = normalizeUnusualWhalesEarningsRows(rows);
      const skippedMicroCount = Number(
        (events as unknown as { skippedMicroCount?: number }).skippedMicroCount ?? 0
      );
      if (rows.length === 0) {
        console.warn("uw_earnings_empty_response", {
          endpoint,
          min_date: range.minDate,
          max_date: range.maxDate
        });
      }
      return { endpoint, events, rowCount: rows.length, skippedMicroCount };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unusual Whales earnings request failed.");
}

function metadataSource(_range: EarningsRange) {
  return SOURCE;
}

function toDbRow(event: UnusualWhalesEarningsEvent) {
  return {
    id: event.id,
    symbol: event.symbol,
    company_name: event.companyName,
    logo: event.logo,
    report_date: event.reportDate,
    report_time: event.reportTime,
    market_time: event.marketTime,
    sector: event.sector,
    is_sp500: event.isSp500,
    market_cap_size: event.marketCapSize,
    market_cap: event.marketCap,
    call_volume: event.callVolume,
    put_volume: event.putVolume,
    expected_move: event.expectedMove,
    implied_move: event.impliedMove,
    implied_move_pct: event.impliedMovePct,
    raw: event.raw,
    content_hash: event.contentHash,
    fetched_at: event.fetchedAt,
    updated_at: new Date().toISOString()
  };
}

function fromDbRow(row: UnknownRecord): UnusualWhalesEarningsEvent {
  const impliedMove = numberOrNull(row.implied_move);
  const expectedMove = numberOrNull(row.expected_move);
  const currentPrice = numberOrNull(isRecord(row.raw) ? row.raw.curr : null);
  const previousPrice = numberOrNull(isRecord(row.raw) ? row.raw.prev : null);
  const impliedMovePct =
    numberOrNull(row.implied_move_pct) ??
    calculateImpliedMovePct({ impliedMove, expectedMove, currentPrice, previousPrice });

  return {
    source: SOURCE,
    id: String(row.id),
    symbol: String(row.symbol),
    companyName: stringOrNull(row.company_name),
    logo: stringOrNull(row.logo),
    reportDate: String(row.report_date),
    reportTime: stringOrNull(row.report_time),
    marketTime: stringOrNull(row.market_time),
    sector: stringOrNull(row.sector),
    isSp500: Boolean(row.is_sp500),
    marketCapSize: stringOrNull(row.market_cap_size),
    marketCap: numberOrNull(row.market_cap),
    callVolume: numberOrNull(row.call_volume),
    putVolume: numberOrNull(row.put_volume),
    expectedMove,
    impliedMove,
    impliedMovePct,
    raw: isRecord(row.raw) ? row.raw : {},
    contentHash: String(row.content_hash ?? ""),
    fetchedAt: String(row.fetched_at ?? new Date().toISOString())
  };
}

function fromMetadataRow(row: UnknownRecord): EarningsMetadata {
  return {
    source: String(row.source),
    ok: Boolean(row.ok),
    fetchedAt: String(row.fetched_at),
    changed: typeof row.changed === "boolean" ? row.changed : null,
    rowCount: typeof row.row_count === "number" ? row.row_count : numberOrNull(row.row_count),
    contentHash: stringOrNull(row.content_hash),
    error: stringOrNull(row.error),
    meta: isRecord(row.meta) ? row.meta : null
  };
}

async function updateMetadata(
  client: SupabaseClient,
  range: EarningsRange,
  values: {
    ok: boolean;
    changed: boolean | null;
    rowCount: number;
    contentHash?: string | null;
    error?: string | null;
  }
) {
  await client.from("data_refresh_metadata").upsert(
    {
      source: metadataSource(range),
      ok: values.ok,
      fetched_at: new Date().toISOString(),
      changed: values.changed,
      row_count: values.rowCount,
      content_hash: values.contentHash ?? null,
      error: values.error ?? null,
      meta: { min_date: range.minDate, max_date: range.maxDate, source: SOURCE }
    },
    { onConflict: "source" }
  );
}

export async function refreshUnusualWhalesEarnings(range = defaultEarningsRange()) {
  const supabase = createServerSupabaseClient();
  let fetched: Awaited<ReturnType<typeof fetchUnusualWhalesEarnings>>;
  try {
    fetched = await fetchUnusualWhalesEarnings(range);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unusual Whales earnings request failed.";
    if (supabase.ok) {
      await updateMetadata(supabase.client, range, {
        ok: false,
        changed: null,
        rowCount: 0,
        error: message
      });
    }
    throw error;
  }
  const contentHash = payloadHash(fetched.events);
  console.log("uw_earnings_normalized", {
    fetched: fetched.rowCount,
    normalized: fetched.events.length,
    skippedMicro: fetched.skippedMicroCount
  });
  if (!supabase.ok) {
    return {
      ok: true,
      persisted: false,
      changed: true,
      range,
      rowCount: fetched.events.length,
      contentHash,
      message: supabase.message
    };
  }

  const { data: metadata } = await supabase.client
    .from("data_refresh_metadata")
    .select("content_hash")
    .eq("source", metadataSource(range))
    .maybeSingle();

  if (metadata?.content_hash === contentHash) {
    await updateMetadata(supabase.client, range, {
      ok: true,
      changed: false,
      rowCount: fetched.events.length,
      contentHash
    });
    return {
      ok: true,
      persisted: true,
      changed: false,
      range,
      rowCount: fetched.events.length,
      contentHash
    };
  }

  const { data: existingRows } = await supabase.client
    .from("unusual_whales_earnings_events")
    .select("id, content_hash")
    .gte("report_date", range.minDate)
    .lte("report_date", range.maxDate);
  const existingHashes = new Map(
    (existingRows ?? []).map((row: { id: string; content_hash: string }) => [
      row.id,
      row.content_hash
    ])
  );
  const changedEvents = fetched.events.filter(
    (event) => existingHashes.get(event.id) !== event.contentHash
  );

  if (changedEvents.length) {
    const { error } = await supabase.client
      .from("unusual_whales_earnings_events")
      .upsert(changedEvents.map(toDbRow), { onConflict: "id" });
    if (error) throw new Error(`Supabase earnings upsert failed: ${error.message}`);
  }
  await updateMetadata(supabase.client, range, {
    ok: true,
    changed: true,
    rowCount: fetched.events.length,
    contentHash
  });
  return {
    ok: true,
    persisted: true,
    changed: true,
    changedRows: changedEvents.length,
    range,
    rowCount: fetched.events.length,
    contentHash
  };
}

function filterAndSortEvents(
  events: UnusualWhalesEarningsEvent[],
  options: {
    symbol?: string;
    sp500Only?: boolean;
    limit?: number;
    order?: string;
  }
) {
  const orderValue = (event: UnusualWhalesEarningsEvent) => {
    switch (options.order) {
      case "market_cap":
        return event.marketCap ?? -1;
      case "expected_move":
        return event.expectedMove ?? -1;
      case "report_date":
        return new Date(event.reportDate).getTime();
      case "call_volume":
        return event.callVolume ?? -1;
      case "put_volume":
        return event.putVolume ?? -1;
      default:
        return event.marketCap ?? -1;
    }
  };
  return suppressUnknownEarningsVariants(events)
    .filter((event) => {
      if (options.symbol && event.symbol !== options.symbol.toUpperCase()) return false;
      if (options.sp500Only && !event.isSp500) return false;
      return true;
    })
    .sort((a, b) => orderValue(b) - orderValue(a))
    .slice(0, options.limit ?? DEFAULT_LIMIT);
}

async function getLiveServerEarnings(
  range: EarningsRange,
  options: {
    symbol?: string;
    sp500Only?: boolean;
    limit?: number;
    order?: string;
  }
): Promise<CachedEarningsResult> {
  const key = stableHash({ range, options });
  if (liveServerCache?.key === key && liveServerCache.expiresAt > Date.now()) {
    return liveServerCache.result;
  }

  const fetched = await fetchUnusualWhalesEarnings(range);
  const events = filterAndSortEvents(fetched.events, options);
  const result: CachedEarningsResult = {
    events,
    metadata: {
      source: metadataSource(range),
      ok: true,
      fetchedAt: new Date().toISOString(),
      changed: null,
      rowCount: fetched.events.length,
      contentHash: payloadHash(fetched.events),
      error: null,
      meta: { min_date: range.minDate, max_date: range.maxDate, cache: "server-memory" }
    },
    mode: "live",
    message: "Using automatic server-side live earnings cache; Supabase persistence is optional."
  };
  liveServerCache = { key, expiresAt: Date.now() + SERVER_CACHE_TTL_MS, result };
  return result;
}

export async function getCachedUnusualWhalesEarnings(
  options: {
    minDate?: string;
    maxDate?: string;
    symbol?: string;
    sp500Only?: boolean;
    limit?: number;
    order?: string;
  } = {}
): Promise<CachedEarningsResult> {
  const range = { minDate: options.minDate, maxDate: options.maxDate };
  const defaults = defaultEarningsRange();
  const minDate = range.minDate ?? defaults.minDate;
  const maxDate = range.maxDate ?? defaults.maxDate;
  const resolvedRange = { minDate, maxDate };
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) {
    try {
      return await getLiveServerEarnings(resolvedRange, options);
    } catch (error) {
      const fallback = await loadStaticFallback();
      const message = error instanceof Error ? error.message : supabase.message;
      return { ...fallback, message: `${message} ${supabase.message}`.trim() };
    }
  }

  let query = supabase.client
    .from("unusual_whales_earnings_events")
    .select(
      "id,symbol,company_name,logo,report_date,report_time,market_time,sector,is_sp500,market_cap_size,market_cap,call_volume,put_volume,expected_move,implied_move,implied_move_pct,raw,content_hash,fetched_at,updated_at"
    )
    .gte("report_date", minDate)
    .lte("report_date", maxDate)
    .gte("market_cap", UW_EARNINGS_MIN_MARKET_CAP)
    .neq("market_cap_size", "micro");
  if (options.symbol) query = query.eq("symbol", options.symbol.toUpperCase());
  if (options.sp500Only) query = query.eq("is_sp500", true);
  const orderMap: Record<string, string> = {
    oi: "market_cap",
    market_cap: "market_cap",
    expected_move: "expected_move",
    report_date: "report_date",
    call_volume: "call_volume",
    put_volume: "put_volume"
  };
  query = query.order(orderMap[options.order ?? "oi"] ?? "market_cap", {
    ascending: false,
    nullsFirst: false
  });
  const { data, error } = await query;
  if (error) {
    try {
      return await getLiveServerEarnings(resolvedRange, options);
    } catch {
      const fallback = await loadStaticFallback();
      return { ...fallback, message: `Supabase earnings read failed: ${error.message}` };
    }
  }

  if (!data?.length) {
    try {
      return await getLiveServerEarnings(resolvedRange, options);
    } catch (error) {
      console.warn("uw_earnings_empty_supabase_live_fetch_failed", {
        min_date: minDate,
        max_date: maxDate,
        error: error instanceof Error ? error.message : "Unknown earnings fetch error"
      });
      // Fall through to returning the empty Supabase result plus metadata.
    }
  }

  const { data: metadata } = await supabase.client
    .from("data_refresh_metadata")
    .select("*")
    .eq("source", metadataSource({ minDate, maxDate }))
    .maybeSingle();
  return {
    events: filterAndSortEvents(
      (data ?? []).map((row) => fromDbRow(row as UnknownRecord)),
      options
    ),
    metadata: metadata ? fromMetadataRow(metadata as UnknownRecord) : null,
    mode: "supabase"
  };
}

async function loadStaticFallback(): Promise<CachedEarningsResult> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(
      process.cwd(),
      "public",
      "data",
      "unusual-whales",
      "earnings-calendar.json"
    );
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as {
      events?: unknown[];
      metadata?: unknown;
    };
    return {
      events: Array.isArray(parsed.events) ? (parsed.events as UnusualWhalesEarningsEvent[]) : [],
      metadata: isRecord(parsed.metadata) ? (parsed.metadata as EarningsMetadata) : null,
      mode: "fallback"
    };
  } catch {
    return {
      events: [],
      metadata: null,
      mode: "unavailable",
      message: "No earnings cache is configured yet."
    };
  }
}
