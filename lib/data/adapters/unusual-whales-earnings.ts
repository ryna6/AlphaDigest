import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";

const UW_EARNINGS_URL = "https://phx.unusualwhales.com/api/companies_earnings/upcoming_earnings_v2";
const SOURCE = "unusual_whales_earnings";
const DEFAULT_LIMIT = 250;
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
  countryCode: string | null;
  countryName: string | null;
  isSp500: boolean;
  hasOptions: boolean;
  marketCapSize: string | null;
  marketCap: number | null;
  currentPrice: number | null;
  previousPrice: number | null;
  openInterest: number | null;
  callVolume: number | null;
  putVolume: number | null;
  stockVolume: number | null;
  expectedMove: number | null;
  impliedMove: number | null;
  streetMeanEstimate: number | null;
  epsMeanEstimate: number | null;
  lastEarningsDate: string | null;
  priceLastEarnings: number | null;
  lastOneDayReactions: number[];
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
  const events = rows
    .map((row) => normalizeUnusualWhalesEarningsRow(row, fetchedAt))
    .filter((event): event is UnusualWhalesEarningsEvent => Boolean(event));
  const deduped = new Map<string, UnusualWhalesEarningsEvent>();
  for (const event of events) deduped.set(event.id, event);
  return Array.from(deduped.values()).sort((a, b) => a.id.localeCompare(b.id));
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
  const reactions = Array.isArray(row.last_1d_reactions)
    ? row.last_1d_reactions.map(numberOrNull).filter((value): value is number => value !== null)
    : [];
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
    countryCode: stringOrNull(row.country_code),
    countryName: stringOrNull(row.country_name),
    isSp500: booleanValue(row.is_s_p_500),
    hasOptions: booleanValue(row.has_options),
    marketCapSize: stringOrNull(row.market_cap_size),
    marketCap: numberOrNull(row.marketcap),
    currentPrice: numberOrNull(row.curr),
    previousPrice: numberOrNull(row.prev),
    openInterest: numberOrNull(row.oi),
    callVolume: numberOrNull(row.call_vol),
    putVolume: numberOrNull(row.put_vol),
    stockVolume: numberOrNull(row.stock_volume),
    expectedMove: numberOrNull(row.expected_move),
    impliedMove: numberOrNull(row.implied_move),
    streetMeanEstimate: numberOrNull(row.street_mean_est),
    epsMeanEstimate: numberOrNull(row.eps_mean_est),
    lastEarningsDate: stringOrNull(row.last_earnings_date),
    priceLastEarnings: numberOrNull(row.price_last_earnings),
    lastOneDayReactions: reactions,
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
        throw new Error(`Unusual Whales earnings request failed with ${response.status}.`);
      }
      const payload = (await response.json()) as unknown;
      const rows = extractRows(payload);
      const events = normalizeUnusualWhalesEarningsRows(rows);
      return { endpoint, events, rowCount: rows.length };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unusual Whales earnings request failed.");
}

function metadataSource(range: EarningsRange) {
  return `${SOURCE}:${range.minDate}:${range.maxDate}`;
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
    country_code: event.countryCode,
    country_name: event.countryName,
    is_sp500: event.isSp500,
    has_options: event.hasOptions,
    market_cap_size: event.marketCapSize,
    market_cap: event.marketCap,
    current_price: event.currentPrice,
    previous_price: event.previousPrice,
    open_interest: event.openInterest,
    call_volume: event.callVolume,
    put_volume: event.putVolume,
    stock_volume: event.stockVolume,
    expected_move: event.expectedMove,
    implied_move: event.impliedMove,
    street_mean_estimate: event.streetMeanEstimate,
    eps_mean_estimate: event.epsMeanEstimate,
    last_earnings_date: event.lastEarningsDate,
    price_last_earnings: event.priceLastEarnings,
    last_one_day_reactions: event.lastOneDayReactions,
    ending_fiscal_quarter:
      typeof event.raw.ending_fiscal_quarter === "string" ? event.raw.ending_fiscal_quarter : null,
    raw: event.raw,
    content_hash: event.contentHash,
    fetched_at: event.fetchedAt,
    updated_at: new Date().toISOString()
  };
}

function fromDbRow(row: UnknownRecord): UnusualWhalesEarningsEvent {
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
    countryCode: stringOrNull(row.country_code),
    countryName: stringOrNull(row.country_name),
    isSp500: Boolean(row.is_sp500),
    hasOptions: Boolean(row.has_options),
    marketCapSize: stringOrNull(row.market_cap_size),
    marketCap: numberOrNull(row.market_cap),
    currentPrice: numberOrNull(row.current_price),
    previousPrice: numberOrNull(row.previous_price),
    openInterest: numberOrNull(row.open_interest),
    callVolume: numberOrNull(row.call_volume),
    putVolume: numberOrNull(row.put_volume),
    stockVolume: numberOrNull(row.stock_volume),
    expectedMove: numberOrNull(row.expected_move),
    impliedMove: numberOrNull(row.implied_move),
    streetMeanEstimate: numberOrNull(row.street_mean_estimate),
    epsMeanEstimate: numberOrNull(row.eps_mean_estimate),
    lastEarningsDate: stringOrNull(row.last_earnings_date),
    priceLastEarnings: numberOrNull(row.price_last_earnings),
    lastOneDayReactions: Array.isArray(row.last_one_day_reactions)
      ? row.last_one_day_reactions
          .map(numberOrNull)
          .filter((value): value is number => value !== null)
      : [],
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
    hasOptions?: boolean;
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
        return event.openInterest ?? -1;
    }
  };
  return events
    .filter((event) => {
      if (options.symbol && event.symbol !== options.symbol.toUpperCase()) return false;
      if (options.sp500Only && !event.isSp500) return false;
      if (options.hasOptions && !event.hasOptions) return false;
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
    hasOptions?: boolean;
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
    hasOptions?: boolean;
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
    .select("*")
    .gte("report_date", minDate)
    .lte("report_date", maxDate);
  if (options.symbol) query = query.eq("symbol", options.symbol.toUpperCase());
  if (options.sp500Only) query = query.eq("is_sp500", true);
  if (options.hasOptions) query = query.eq("has_options", true);
  const orderMap: Record<string, string> = {
    oi: "open_interest",
    market_cap: "market_cap",
    expected_move: "expected_move",
    report_date: "report_date",
    call_volume: "call_volume",
    put_volume: "put_volume"
  };
  query = query
    .order(orderMap[options.order ?? "oi"] ?? "open_interest", {
      ascending: false,
      nullsFirst: false
    })
    .limit(options.limit ?? DEFAULT_LIMIT);
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
      const refreshed = await refreshUnusualWhalesEarnings(resolvedRange);
      const seeded = await fetchUnusualWhalesEarnings(resolvedRange);
      const events = filterAndSortEvents(seeded.events, options);
      return {
        events,
        metadata: {
          source: metadataSource(resolvedRange),
          ok: true,
          fetchedAt: new Date().toISOString(),
          changed: refreshed.changed,
          rowCount: refreshed.rowCount,
          contentHash: refreshed.contentHash,
          error: null,
          meta: { min_date: minDate, max_date: maxDate, auto_seeded: true }
        },
        mode: refreshed.persisted ? "supabase" : "live"
      };
    } catch {
      // Fall through to returning the empty Supabase result plus metadata.
    }
  }

  const { data: metadata } = await supabase.client
    .from("data_refresh_metadata")
    .select("*")
    .eq("source", metadataSource({ minDate, maxDate }))
    .maybeSingle();
  return {
    events: (data ?? []).map((row) => fromDbRow(row as UnknownRecord)),
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
