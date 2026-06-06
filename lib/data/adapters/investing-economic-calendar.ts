import { formatEtDateKey, formatEtTime } from "@/lib/utils/time";
import type { ImportantEconomicEventKey } from "../config/included-economic-events";
import {
  getImportantEconomicEventKey,
  getImportantEconomicEventLabel,
  shouldIncludeEconomicEvent
} from "../config/included-economic-events";

const INVESTING_ECONOMIC_CALENDAR_ENDPOINT =
  "https://endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences";
const INVESTING_ECONOMIC_CALENDAR_PAGE = "https://www.investing.com/economic-calendar/";
const ECONOMIC_CALENDAR_TIMEOUT_MS = 12_000;
const ECONOMIC_CALENDAR_RETRIES = 1;
const ECONOMIC_CALENDAR_FAILURE_COOLDOWN_MS = 60_000;

type UnknownRecord = Record<string, unknown>;

export type InvestingEconomicEvent = {
  source: "investing_com";
  id: string;
  eventId: number | string | null;
  eventKey: ImportantEconomicEventKey | null;
  eventName: string;
  eventDate: string;
  time: string | null;
  timestamp: string | null;
  importance: "medium" | "high" | string | null;
  stars: 1 | 2 | 3 | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  referencePeriod: string | null;
  isHighlighted: boolean;
  highlightReason: string | null;
  country: string | null;
  fetchedAt: string;
  raw: Record<string, unknown>;
};

type FetchResult = {
  events: InvestingEconomicEvent[];
  mode: "live" | "unavailable";
  message?: string;
};

type MemoryCacheEntry = {
  events: InvestingEconomicEvent[];
  expiresAt: number;
  fetchedAt: string;
};

type FailureCooldownEntry = {
  expiresAt: number;
  message: string;
};

const memoryCache = new Map<string, MemoryCacheEntry>();
const failureCooldownCache = new Map<string, FailureCooldownEntry>();

export function buildInvestingEconomicCalendarCacheKey(dateKey: string) {
  return `investing-economic:US:medium-high:${dateKey}`;
}

function shouldDebugEconomicCalendar() {
  return process.env.ECONOMIC_CALENDAR_DEBUG === "1";
}

function debugEconomicCalendar(message: string, details: Record<string, unknown>) {
  if (!shouldDebugEconomicCalendar()) return;
  console.info(`[economic-calendar] ${message}`, details);
}

function economicCalendarCacheTtlMs(dateKey: string) {
  const todayKey = formatEtDateKey(new Date());
  if (todayKey && dateKey === todayKey) return 5 * 60_000;
  if (todayKey && dateKey < todayKey) return 24 * 60 * 60_000;
  return 30 * 60_000;
}

function cacheInvestingEconomicEvents(
  cacheKey: string,
  dateKey: string,
  events: InvestingEconomicEvent[]
) {
  memoryCache.set(cacheKey, {
    events,
    expiresAt: Date.now() + economicCalendarCacheTtlMs(dateKey),
    fetchedAt: new Date().toISOString()
  });
}

function getFreshInvestingEconomicEvents(cacheKey: string) {
  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt > Date.now()) return cached.events;
  return null;
}

function investingEconomicErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Investing.com economic calendar unavailable.";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumberOrString(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) && /^\d+$/.test(text) ? numeric : text;
}

function getPath(record: UnknownRecord, paths: string[][]): unknown {
  for (const path of paths) {
    let current: unknown = record;
    for (const key of path) {
      if (!isRecord(current)) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return undefined;
}

function getTimezoneOffset(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset"
  }).formatToParts(date);
  const offsetName = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = offsetName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "-05:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
}

function isWeekendDateKey(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function buildInvestingEconomicCalendarUrl(dateKey: string) {
  const offset = getTimezoneOffset(dateKey);
  const params = new URLSearchParams({
    domain_id: "1",
    limit: "200",
    start_date: `${dateKey}T00:00:00.000${offset}`,
    end_date: `${dateKey}T23:59:59.999${offset}`,
    country_ids: "5",
    importance: "medium,high"
  });
  return `${INVESTING_ECONOMIC_CALENDAR_ENDPOINT}?${params.toString()}`;
}

function normalizeImportance(value: unknown): InvestingEconomicEvent["importance"] {
  const text = asString(value)?.toLowerCase();
  if (!text) return null;
  if (text === "3" || text.includes("high")) return "high";
  if (text === "2" || text.includes("medium")) return "medium";
  if (text === "1" || text.includes("low")) return "low";
  return text;
}

function starsFromImportance(importance: InvestingEconomicEvent["importance"]): 1 | 2 | 3 | null {
  if (importance === "high") return 3;
  if (importance === "medium") return 2;
  if (importance === "low") return 1;
  return null;
}

function normalizeTimestamp(value: unknown, dateKey: string): string | null {
  const text = asString(value);
  if (!text) return null;
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text))
    return `${dateKey}T${text.length === 5 ? `${text}:00` : text}${getTimezoneOffset(dateKey)}`;
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  return text;
}

function eventIdKey(value: unknown) {
  const id = asNumberOrString(value);
  return id === null ? null : String(id);
}

function mergeInvestingEventsWithOccurrences(payload: UnknownRecord): UnknownRecord[] {
  const events = Array.isArray(payload.events) ? payload.events.filter(isRecord) : [];
  const occurrences = Array.isArray(payload.occurrences)
    ? payload.occurrences.filter(isRecord)
    : [];
  if (!events.length || !occurrences.length) return [];

  const eventsById = new Map<string, UnknownRecord>();
  events.forEach((event) => {
    const key = eventIdKey(event.event_id ?? event.eventId ?? event.id);
    if (key) eventsById.set(key, event);
  });

  return occurrences.map((occurrence) => {
    const key = eventIdKey(occurrence.event_id ?? occurrence.eventId ?? occurrence.id);
    return { ...(key ? eventsById.get(key) : undefined), ...occurrence };
  });
}

function extractRows(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];

  const mergedRows = mergeInvestingEventsWithOccurrences(payload);
  if (mergedRows.length) return mergedRows;

  for (const key of ["data", "events", "occurrences", "results", "rows"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      const nested = extractRows(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function formatEconomicValue(row: UnknownRecord, paths: string[][]) {
  const raw = getPath(row, paths);
  const value = asString(raw);
  if (value === null) return null;

  const unit = asString(row.unit);
  if (unit && typeof raw === "number") return `${value}${unit}`;
  return value;
}

function compactInvestingEconomicRaw(
  row: UnknownRecord,
  normalized: {
    eventId: number | string | null;
    time: string | null;
    eventName: string;
    country: string | null;
    importance: InvestingEconomicEvent["importance"];
    actual: string | null;
    forecast: string | null;
    previous: string | null;
    unit: string | null;
    referencePeriod: string | null;
  }
) {
  return {
    event_id: normalized.eventId,
    time: normalized.time,
    event_name: normalized.eventName,
    country: normalized.country,
    importance: normalized.importance,
    actual: normalized.actual,
    forecast: normalized.forecast,
    previous: normalized.previous,
    unit: normalized.unit,
    reference_period: normalized.referencePeriod,
    source_datetime: asString(
      getPath(row, [["datetime"], ["date_time"], ["date"], ["timestamp"], ["occurrence_time"]])
    )
  };
}

function normalizeInvestingEconomicRow(
  row: UnknownRecord,
  dateKey: string,
  fetchedAt: string
): InvestingEconomicEvent | null {
  const eventId = asNumberOrString(
    getPath(row, [
      ["event_id"],
      ["eventId"],
      ["event", "id"],
      ["event", "event_id"],
      ["economic_event_id"],
      ["id"]
    ])
  );
  const eventName = asString(
    getPath(row, [
      ["event_name"],
      ["eventName"],
      ["event", "name"],
      ["event", "title"],
      ["event_translated"],
      ["event_meta_title"],
      ["long_name"],
      ["short_name"],
      ["name"],
      ["title"]
    ])
  );
  if (!eventName) return null;

  if (!shouldIncludeEconomicEvent(eventName)) return null;
  const eventKey = getImportantEconomicEventKey(eventId, eventName);
  const highlightReason = getImportantEconomicEventLabel(eventKey);

  const timestamp = normalizeTimestamp(
    getPath(row, [
      ["datetime"],
      ["date_time"],
      ["date"],
      ["time"],
      ["timestamp"],
      ["occurrence_time"],
      ["occurrenceTime"]
    ]),
    dateKey
  );
  const importance = normalizeImportance(
    getPath(row, [["importance"], ["importance_level"], ["impact"], ["volatility"]])
  );
  if (importance === "low") return null;

  const country = asString(getPath(row, [["country"], ["country_name"], ["country", "name"]]));
  const unit = asString(getPath(row, [["unit"], ["event", "unit"]]));
  const referencePeriod = asString(
    getPath(row, [
      ["reference_period"],
      ["referencePeriod"],
      ["period"],
      ["period_name"],
      ["event", "reference_period"]
    ])
  );
  const actual = formatEconomicValue(row, [["actual"], ["actual_value"], ["actualValue"]]);
  const forecast = formatEconomicValue(row, [
    ["forecast"],
    ["consensus"],
    ["forecast_value"],
    ["forecastValue"]
  ]);
  const previous = formatEconomicValue(row, [
    ["previous"],
    ["prev"],
    ["previous_value"],
    ["previousValue"]
  ]);
  const normalized = {
    eventId,
    time: timestamp,
    eventName,
    country,
    importance,
    actual,
    forecast,
    previous,
    unit,
    referencePeriod
  };

  return {
    source: "investing_com",
    id: `investing-economic:${dateKey}:${eventId ?? eventName}:${timestamp ?? "unknown"}`,
    eventId,
    eventKey,
    eventName,
    eventDate: dateKey,
    time: timestamp ? formatEtTime(timestamp) : null,
    timestamp,
    importance,
    stars: starsFromImportance(importance),
    actual,
    forecast,
    previous,
    unit,
    referencePeriod,
    isHighlighted: Boolean(eventKey),
    highlightReason,
    country,
    fetchedAt,
    raw: compactInvestingEconomicRaw(row, normalized)
  };
}

export function normalizeInvestingEconomicCalendarPayload(
  payload: unknown,
  dateKey: string,
  fetchedAt = new Date().toISOString()
) {
  return extractRows(payload)
    .map((row) => normalizeInvestingEconomicRow(row, dateKey, fetchedAt))
    .filter((event): event is InvestingEconomicEvent => Boolean(event))
    .sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ECONOMIC_CALENDAR_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.investing.com",
        Referer: INVESTING_ECONOMIC_CALENDAR_PAGE
      },
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPayload(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= ECONOMIC_CALENDAR_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);
      if (response.ok) return (await response.json()) as unknown;

      const retryAfter = response.headers.get("retry-after");
      const message = `Investing.com economic calendar responded ${response.status}`;
      if (response.status === 429) {
        throw new Error(retryAfter ? `${message}; retry-after=${retryAfter}` : message);
      }
      if (![500, 502, 503, 504].includes(response.status)) throw new Error(message);
      lastError = new Error(message);
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.includes("responded 429")) break;
    }
    if (attempt < ECONOMIC_CALENDAR_RETRIES) await sleep(500 * 2 ** attempt);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Investing.com economic calendar failed");
}

export async function fetchInvestingEconomicCalendar(
  dateKey = formatEtDateKey(new Date()) ?? ""
): Promise<FetchResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { events: [], mode: "unavailable", message: "Invalid economic calendar date." };
  }
  if (isWeekendDateKey(dateKey)) {
    return { events: [], mode: "live" };
  }

  const cacheKey = buildInvestingEconomicCalendarCacheKey(dateKey);
  const freshCached = getFreshInvestingEconomicEvents(cacheKey);
  if (freshCached) {
    debugEconomicCalendar("cache-hit", {
      dateKey,
      cacheKey,
      numberOfEventsFetched: freshCached.length
    });
    return { events: freshCached, mode: "live" };
  }

  const failureCooldown = failureCooldownCache.get(cacheKey);
  if (failureCooldown && failureCooldown.expiresAt > Date.now()) {
    const stale = memoryCache.get(cacheKey)?.events ?? [];
    return { events: stale, mode: "unavailable", message: failureCooldown.message };
  }

  const url = buildInvestingEconomicCalendarUrl(dateKey);
  const fetchedAt = new Date().toISOString();

  debugEconomicCalendar("fetch", { dateKey, cacheKey, investingCalendarUrl: url });

  try {
    const payload = await fetchPayload(url);
    const events = normalizeInvestingEconomicCalendarPayload(payload, dateKey, fetchedAt).filter(
      (event) => event.eventDate === dateKey
    );
    cacheInvestingEconomicEvents(cacheKey, dateKey, events);
    failureCooldownCache.delete(cacheKey);
    debugEconomicCalendar("fetched", { dateKey, cacheKey, numberOfEventsFetched: events.length });
    return { events, mode: "live" };
  } catch (error) {
    const message = investingEconomicErrorMessage(error);
    const stale = memoryCache.get(cacheKey)?.events ?? [];
    failureCooldownCache.set(cacheKey, {
      expiresAt: Date.now() + ECONOMIC_CALENDAR_FAILURE_COOLDOWN_MS,
      message
    });
    console.warn("economic_calendar_fetch_error", {
      date: dateKey,
      cacheKey,
      staleCount: stale.length,
      error: message
    });
    return { events: stale, mode: "unavailable", message };
  }
}

export function investingEconomicSources() {
  return {
    calendar: INVESTING_ECONOMIC_CALENDAR_PAGE,
    endpoint: INVESTING_ECONOMIC_CALENDAR_ENDPOINT
  };
}

import { createServerSupabaseClient } from "@/lib/db/supabase";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";
import { stableHash } from "./unusual-whales-earnings";

const INVESTING_METADATA_SOURCE = "investing_economic_events";

type CachedEconomicResult = FetchResult & { metadata?: Record<string, unknown> | null };

function eventContentHash(event: InvestingEconomicEvent) {
  return stableHash({
    id: event.id,
    eventId: event.eventId,
    eventKey: event.eventKey,
    eventName: event.eventName,
    eventDate: event.eventDate,
    time: event.time,
    timestamp: event.timestamp,
    importance: event.importance,
    stars: event.stars,
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    unit: event.unit,
    referencePeriod: event.referencePeriod,
    isHighlighted: event.isHighlighted,
    highlightReason: event.highlightReason,
    country: event.country
  });
}

function economicToDbRow(event: InvestingEconomicEvent) {
  return {
    id: event.id,
    event_id: event.eventId === null ? null : String(event.eventId),
    event_key: event.eventKey,
    event_name: event.eventName,
    event_date: event.eventDate,
    time: event.time,
    event_time: event.timestamp,
    importance: event.importance,
    stars: event.stars,
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    unit: event.unit,
    reference_period: event.referencePeriod,
    is_highlighted: event.isHighlighted,
    highlight_reason: event.highlightReason,
    country: event.country,
    source_name: event.source,
    source_url: buildInvestingEconomicCalendarUrl(event.eventDate),
    raw: event.raw,
    content_hash: eventContentHash(event),
    fetched_at: event.fetchedAt,
    updated_at: new Date().toISOString()
  };
}

function economicFromDbRow(row: UnknownRecord): InvestingEconomicEvent {
  return {
    source: "investing_com",
    id: String(row.id),
    eventId: asNumberOrString(row.event_id),
    eventKey: asString(row.event_key) as ImportantEconomicEventKey | null,
    eventName: String(row.event_name ?? ""),
    eventDate: String(row.event_date),
    time: asString(row.time),
    timestamp: asString(row.event_time),
    importance: asString(row.importance),
    stars:
      row.stars === 1 || row.stars === 2 || row.stars === 3
        ? row.stars
        : starsFromImportance(asString(row.importance)),
    actual: asString(row.actual),
    forecast: asString(row.forecast),
    previous: asString(row.previous),
    unit: asString(row.unit),
    referencePeriod: asString(row.reference_period),
    isHighlighted: Boolean(row.is_highlighted),
    highlightReason: asString(row.highlight_reason),
    country: asString(row.country),
    fetchedAt: asString(row.fetched_at) ?? new Date().toISOString(),
    raw: isRecord(row.raw) ? row.raw : {}
  };
}

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateKeysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end)
    return [];
  const keys: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const key = dateKeyFromDate(cursor);
    if (!isWeekendDateKey(key)) keys.push(key);
  }
  return keys;
}

export function defaultEconomicRefreshDateKeys(date = new Date()) {
  const keys: string[] = [];
  for (let offset = 0; keys.length < 5 && offset < 10; offset += 1) {
    const key = dateKeyFromDate(addUtcDays(date, -offset));
    if (!isWeekendDateKey(key)) keys.push(key);
  }
  return keys.reverse();
}

export async function refreshInvestingEconomicEvents(dateKeys = defaultEconomicRefreshDateKeys()) {
  const uniqueDateKeys = Array.from(
    new Set(dateKeys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && !isWeekendDateKey(key)))
  );
  const supabase = createServerSupabaseClient();
  const events: InvestingEconomicEvent[] = [];
  const fetchMeta: Array<Record<string, unknown>> = [];

  for (const dateKey of uniqueDateKeys) {
    const url = buildInvestingEconomicCalendarUrl(dateKey);
    console.log("force_refresh_fetch", { source: INVESTING_METADATA_SOURCE, date: dateKey, url });
    const result = await fetchInvestingEconomicCalendar(dateKey);
    fetchMeta.push({ date: dateKey, mode: result.mode, count: result.events.length, url });
    events.push(...result.events.filter((event) => event.eventDate === dateKey));
  }

  const deduped = Array.from(new Map(events.map((event) => [event.id, event])).values());
  const rows = deduped.map(economicToDbRow);
  const contentHash = payloadContentHash(
    rows.map(({ fetched_at: _fetchedAt, updated_at: _updatedAt, ...row }) => row)
  );
  console.log("force_refresh_normalized", {
    source: INVESTING_METADATA_SOURCE,
    fetched: events.length,
    normalized: rows.length
  });

  if (!supabase.ok)
    return sourceResult({
      ok: true,
      count: rows.length,
      changed: true,
      contentHash,
      persisted: false,
      error: supabase.message,
      meta: { dates: uniqueDateKeys }
    });

  try {
    const { data: metadata } = await supabase.client
      .from("data_refresh_metadata")
      .select("content_hash")
      .eq("source", INVESTING_METADATA_SOURCE)
      .maybeSingle();
    const changed = metadata?.content_hash !== contentHash;
    let upserted = 0;
    if (rows.length && changed) {
      const { error } = await supabase.client
        .from("investing_economic_events")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase economic events upsert failed: ${error.message}`);
      upserted = rows.length;
    }
    await updateRefreshMetadata(supabase.client, INVESTING_METADATA_SOURCE, {
      ok: true,
      changed,
      rowCount: rows.length,
      contentHash,
      meta: { dates: uniqueDateKeys, fetches: fetchMeta }
    });
    console.log("force_refresh_upserted", { source: INVESTING_METADATA_SOURCE, upserted, changed });
    return sourceResult({
      ok: true,
      count: rows.length,
      changed,
      contentHash,
      upserted,
      persisted: true,
      meta: { dates: uniqueDateKeys }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown economic events refresh error";
    await updateRefreshMetadata(supabase.client, INVESTING_METADATA_SOURCE, {
      ok: false,
      changed: null,
      rowCount: rows.length,
      contentHash,
      error: message,
      meta: { dates: uniqueDateKeys, fetches: fetchMeta }
    });
    console.error("force_refresh_error", { source: INVESTING_METADATA_SOURCE, error: message });
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: null,
      contentHash,
      error: message,
      persisted: true,
      meta: { dates: uniqueDateKeys }
    });
  }
}

export function economicRefreshDateKeysFromParams(params: URLSearchParams) {
  const date = params.get("date");
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return isWeekendDateKey(date) ? [] : [date];
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");
  if (
    startDate &&
    endDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    return dateKeysBetween(startDate, endDate);
  }
  return defaultEconomicRefreshDateKeys();
}

export async function getCachedInvestingEconomicCalendar(
  dateKey = formatEtDateKey(new Date()) ?? ""
): Promise<CachedEconomicResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))
    return { events: [], mode: "unavailable", message: "Invalid economic calendar date." };
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { events: [], mode: "unavailable", message: supabase.message };
  const { data, error } = await supabase.client
    .from("investing_economic_events")
    .select("*")
    .eq("event_date", dateKey)
    .order("event_time", { ascending: true, nullsFirst: false });
  if (error || !data?.length) {
    return {
      events: [],
      mode: "unavailable",
      message: error
        ? `Supabase economic events read failed: ${error.message}`
        : "Supabase economic events cache is empty for selected date."
    };
  }
  return { events: data.map((row) => economicFromDbRow(row as UnknownRecord)), mode: "live" };
}
