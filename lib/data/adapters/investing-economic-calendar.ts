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
const ECONOMIC_CALENDAR_RETRIES = 2;
const INVESTING_DOMAIN_ID = "www";
const INVESTING_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

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
  isHighlighted: boolean;
  highlightReason: string | null;
  fetchedAt: string;
  raw: Record<string, unknown>;
};

type FetchResult = {
  events: InvestingEconomicEvent[];
  mode: "live" | "unavailable";
  message?: string;
  diagnostics?: Record<string, unknown>;
};

export type EconomicSkipReasons = {
  missingEventName: number;
  unsupportedImportance: number;
  excludedByIncludedEventRules: number;
  missingTimestamp: number;
  outsideRequestedRange: number;
  malformedRow: number;
};

const memoryCache = new Map<string, InvestingEconomicEvent[]>();

function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addDaysToDateKey(dateKey: string, days: number) {
  return dateKeyFromDate(addUtcDays(new Date(`${dateKey}T00:00:00Z`), days));
}

function mondayForDateKey(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysToDateKey(dateKey, -daysFromMonday);
}

export function buildInvestingEconomicCalendarWeekRange(dateKey: string) {
  const startDate = mondayForDateKey(dateKey);
  return { startDate, endDate: addDaysToDateKey(startDate, 6) };
}

export function buildInvestingEconomicCalendarCacheKey(dateKey: string) {
  const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
  return `investing-economic:US:medium-high:${startDate}:${endDate}`;
}

function shouldDebugEconomicCalendar() {
  return process.env.ECONOMIC_CALENDAR_DEBUG === "1";
}

function debugEconomicCalendar(message: string, details: Record<string, unknown>) {
  if (!shouldDebugEconomicCalendar()) return;
  console.info(`[economic-calendar] ${message}`, details);
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
    timeZone: "America/Toronto",
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
  const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
  const startOffset = getTimezoneOffset(startDate);
  const endOffset = getTimezoneOffset(endDate);
  const params = new URLSearchParams({
    domain_id: "1",
    limit: "200",
    start_date: `${startDate}T00:00:00.000${startOffset}`,
    end_date: `${endDate}T23:59:59.999${endOffset}`,
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
    const nestedOccurrence = isRecord(occurrence.occurrence) ? occurrence.occurrence : {};
    const key = eventIdKey(
      occurrence.event_id ??
        occurrence.eventId ??
        nestedOccurrence.event_id ??
        (isRecord(occurrence.event) ? occurrence.event.id : undefined) ??
        occurrence.id
    );
    return {
      ...(key ? eventsById.get(key) : undefined),
      ...(isRecord(occurrence.event) ? occurrence.event : undefined),
      ...occurrence,
      ...nestedOccurrence
    };
  });
}

export function extractInvestingEconomicRows(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];

  const mergedRows = mergeInvestingEventsWithOccurrences(payload);
  if (mergedRows.length) return mergedRows;

  for (const key of ["data", "events", "occurrences", "results", "rows"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      const nested = extractInvestingEconomicRows(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function isRecognizedInvestingPayload(payload: unknown): boolean {
  if (Array.isArray(payload)) return true;
  if (!isRecord(payload)) return false;
  if (["data", "events", "occurrences", "results", "rows"].some((key) => key in payload))
    return true;
  return Object.values(payload).some(
    (value) => isRecord(value) && isRecognizedInvestingPayload(value)
  );
}

export function inspectInvestingEconomicPayload(payload: unknown) {
  const arrays: Array<{ path: string; count: number }> = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > 6 || !isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (Array.isArray(child)) arrays.push({ path: childPath, count: child.length });
      else if (isRecord(child)) visit(child, childPath, depth + 1);
    }
  };
  visit(payload, "$", 0);
  return {
    topLevelKeys: isRecord(payload) ? Object.keys(payload).slice(0, 30) : [],
    arrays: arrays.slice(0, 30),
    rawRows: extractInvestingEconomicRows(payload).length
  };
}

function formatEconomicValue(row: UnknownRecord, paths: string[][]) {
  const raw = getPath(row, paths);
  const value = asString(raw);
  if (value === null) return null;

  const unit = asString(row.unit);
  if (unit && typeof raw === "number") return `${value}${unit}`;
  return value;
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
      ["occurrenceTime"],
      ["occurrence", "datetime"],
      ["occurrence", "timestamp"]
    ]),
    dateKey
  );
  const importance = normalizeImportance(
    getPath(row, [
      ["importance"],
      ["importance_level"],
      ["impact"],
      ["volatility"],
      ["event", "importance"],
      ["event", "importance_level"]
    ])
  );
  if (importance === "low") return null;

  const eventDate = (timestamp ? formatEtDateKey(timestamp) : null) ?? dateKey;

  return {
    source: "investing_com",
    id: `investing-economic:${eventDate}:${eventId ?? eventName}:${timestamp ?? "unknown"}`,
    eventId,
    eventKey,
    eventName,
    eventDate,
    time: timestamp ? formatEtTime(timestamp) : null,
    timestamp,
    importance,
    stars: starsFromImportance(importance),
    actual: formatEconomicValue(row, [["actual"], ["actual_value"], ["actualValue"]]),
    forecast: formatEconomicValue(row, [
      ["forecast"],
      ["consensus"],
      ["forecast_value"],
      ["forecastValue"]
    ]),
    previous: formatEconomicValue(row, [
      ["previous"],
      ["prev"],
      ["previous_value"],
      ["previousValue"]
    ]),
    isHighlighted: Boolean(eventKey),
    highlightReason,
    fetchedAt,
    raw: row
  };
}

export function normalizeInvestingEconomicCalendarPayload(
  payload: unknown,
  dateKey: string,
  fetchedAt = new Date().toISOString()
) {
  return extractInvestingEconomicRows(payload)
    .map((row) => normalizeInvestingEconomicRow(row, dateKey, fetchedAt))
    .filter((event): event is InvestingEconomicEvent => Boolean(event))
    .sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
}

export function diagnoseInvestingEconomicCalendarPayload(
  payload: unknown,
  dateKey: string,
  fetchedAt = new Date().toISOString()
) {
  const rows = extractInvestingEconomicRows(payload);
  const range = buildInvestingEconomicCalendarWeekRange(dateKey);
  const skipReasons: EconomicSkipReasons = {
    missingEventName: 0,
    unsupportedImportance: 0,
    excludedByIncludedEventRules: 0,
    missingTimestamp: 0,
    outsideRequestedRange: 0,
    malformedRow: 0
  };
  const events: InvestingEconomicEvent[] = [];
  for (const row of rows) {
    if (!isRecord(row)) {
      skipReasons.malformedRow += 1;
      continue;
    }
    const name = asString(
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
    if (!name) {
      skipReasons.missingEventName += 1;
      continue;
    }
    if (!shouldIncludeEconomicEvent(name)) {
      skipReasons.excludedByIncludedEventRules += 1;
      continue;
    }
    const importance = normalizeImportance(
      getPath(row, [
        ["importance"],
        ["importance_level"],
        ["impact"],
        ["volatility"],
        ["event", "importance"],
        ["event", "importance_level"]
      ])
    );
    if (!importance || importance === "low") {
      skipReasons.unsupportedImportance += 1;
      continue;
    }
    const event = normalizeInvestingEconomicRow(row, dateKey, fetchedAt);
    if (!event) {
      skipReasons.malformedRow += 1;
      continue;
    }
    if (!event.timestamp) skipReasons.missingTimestamp += 1;
    if (event.eventDate < range.startDate || event.eventDate > range.endDate) {
      skipReasons.outsideRequestedRange += 1;
      continue;
    }
    events.push(event);
  }
  const deduped = Array.from(new Map(events.map((event) => [event.id, event])).values()).sort(
    (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime()
  );
  return {
    events: deduped,
    diagnostics: {
      ...inspectInvestingEconomicPayload(payload),
      rowsWithEventNames: rows.length - skipReasons.missingEventName,
      rowsPassingIncludedEventRules: events.length + skipReasons.outsideRequestedRange,
      normalizedRows: events.length,
      deduplicatedRows: deduped.length,
      skipReasons,
      timestampSamples: deduped.slice(0, 3).map((event) => ({
        raw: event.raw.datetime ?? event.raw.timestamp ?? event.raw.date ?? null,
        easternDate: event.eventDate
      }))
    }
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Investing's pd-instruments gateway uses the Domain-Id header to select the
 * public web tenant. The domain_id query parameter filters the calendar data,
 * but does not replace this gateway header; requests without it are rejected
 * with 403 before they reach the calendar service.
 */
export function buildInvestingEconomicCalendarRequestHeaders() {
  return {
    "User-Agent": INVESTING_BROWSER_USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Domain-Id": INVESTING_DOMAIN_ID,
    Origin: "https://www.investing.com",
    Referer: INVESTING_ECONOMIC_CALENDAR_PAGE
  };
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ECONOMIC_CALENDAR_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: buildInvestingEconomicCalendarRequestHeaders(),
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
      if (response.ok) {
        const text = await response.text();
        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(
            `Investing.com economic calendar returned non-JSON ${response.headers.get("content-type") ?? "content"}`
          );
        }
        if (!isRecognizedInvestingPayload(payload))
          throw new Error(
            "Investing.com economic calendar returned JSON without an events collection"
          );
        return {
          payload,
          response: {
            httpStatus: response.status,
            finalUrl: response.url,
            contentType: response.headers.get("content-type"),
            responseBytes: new TextEncoder().encode(text).length
          }
        };
      }
      if (![429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`Investing.com economic calendar responded ${response.status}`);
      }
      lastError = new Error(`Investing.com economic calendar responded ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < ECONOMIC_CALENDAR_RETRIES) await sleep(350 * 2 ** attempt);
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
  const cacheKey = buildInvestingEconomicCalendarCacheKey(dateKey);
  const cached = memoryCache.get(cacheKey);
  const url = buildInvestingEconomicCalendarUrl(dateKey);
  const fetchedAt = new Date().toISOString();

  debugEconomicCalendar("fetch", { dateKey, cacheKey, investingCalendarUrl: url });

  try {
    const fetched = await fetchPayload(url);
    const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
    const analyzed = diagnoseInvestingEconomicCalendarPayload(fetched.payload, dateKey, fetchedAt);
    const events = analyzed.events.filter(
      (event) => event.eventDate >= startDate && event.eventDate <= endDate
    );
    const rawRows = analyzed.diagnostics.rawRows;
    if (typeof rawRows !== "number" || rawRows === 0)
      throw new Error(
        "Investing.com economic calendar returned an empty events collection; existing cache preserved"
      );
    memoryCache.set(cacheKey, events);
    debugEconomicCalendar("fetched", { dateKey, cacheKey, numberOfEventsFetched: events.length });
    return {
      events,
      mode: "live",
      diagnostics: {
        ...fetched.response,
        ...analyzed.diagnostics,
        requestedDateKey: dateKey,
        requestedWeekStart: startDate,
        requestedWeekEnd: endDate,
        url
      }
    };
  } catch (error) {
    return {
      events: cached ?? [],
      mode: "unavailable",
      message:
        error instanceof Error ? error.message : "Investing.com economic calendar unavailable."
    };
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

const INVESTING_METADATA_SOURCE = "investing_economic_events";

type CachedEconomicResult = FetchResult & { metadata?: Record<string, unknown> | null };

function economicToDbRow(event: InvestingEconomicEvent) {
  return {
    id: event.id,
    event_id: event.eventId === null ? null : String(event.eventId),
    event_key: event.eventKey,
    event_name: event.eventName,
    event_date: event.eventDate,
    event_time: event.timestamp,
    importance: event.importance,
    stars: event.stars,
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    is_highlighted: event.isHighlighted,
    highlight_reason: event.highlightReason,
    fetched_at: event.fetchedAt
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
    time: asString(row.event_time) ? formatEtTime(String(row.event_time)) : null,
    timestamp: asString(row.event_time),
    importance: asString(row.importance),
    stars:
      row.stars === 1 || row.stars === 2 || row.stars === 3
        ? row.stars
        : starsFromImportance(asString(row.importance)),
    actual: asString(row.actual),
    forecast: asString(row.forecast),
    previous: asString(row.previous),
    isHighlighted: Boolean(row.is_highlighted),
    highlightReason: asString(row.highlight_reason),
    fetchedAt: asString(row.fetched_at) ?? new Date().toISOString(),
    raw: {}
  };
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
  const todayKey = formatEtDateKey(date) ?? dateKeyFromDate(date);
  const currentWeek = buildInvestingEconomicCalendarWeekRange(todayKey).startDate;
  return [addDaysToDateKey(currentWeek, -7), currentWeek, addDaysToDateKey(currentWeek, 7)];
}

export async function refreshInvestingEconomicEvents(dateKeys = defaultEconomicRefreshDateKeys()) {
  const correlationId = crypto.randomUUID();
  const refreshStarted = Date.now();
  const uniqueDateKeys = Array.from(
    new Set(
      dateKeys
        .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
        .map((key) => buildInvestingEconomicCalendarWeekRange(key).startDate)
    )
  );
  const supabase = createServerSupabaseClient();
  const events: InvestingEconomicEvent[] = [];
  const fetchMeta: Array<Record<string, unknown>> = [];

  for (const dateKey of uniqueDateKeys) {
    const url = buildInvestingEconomicCalendarUrl(dateKey);
    console.log("economic_refresh_started", {
      correlationId,
      source: INVESTING_METADATA_SOURCE,
      date: dateKey,
      url
    });
    const result = await fetchInvestingEconomicCalendar(dateKey);
    if (result.mode !== "live")
      throw new Error(
        `Investing.com economic calendar fetch failed for ${dateKey}: ${result.message ?? "unknown provider error"}`
      );
    fetchMeta.push({
      date: dateKey,
      mode: result.mode,
      count: result.events.length,
      url,
      diagnostics: result.diagnostics,
      message: result.message
    });
    console.log("economic_endpoint_response", {
      correlationId,
      date: dateKey,
      ...result.diagnostics
    });
    console.log("economic_payload_inspected", {
      correlationId,
      date: dateKey,
      topLevelKeys: result.diagnostics?.topLevelKeys,
      arrays: result.diagnostics?.arrays
    });
    console.log("economic_rows_extracted", {
      correlationId,
      date: dateKey,
      rawRows: result.diagnostics?.rawRows
    });
    console.log("economic_rows_filtered", {
      correlationId,
      date: dateKey,
      normalizedRows: result.diagnostics?.normalizedRows,
      skipReasons: result.diagnostics?.skipReasons
    });
    const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
    events.push(
      ...result.events.filter((event) => event.eventDate >= startDate && event.eventDate <= endDate)
    );
  }

  const deduped = Array.from(new Map(events.map((event) => [event.id, event])).values());
  const rows = deduped.map(economicToDbRow);
  const contentHash = payloadContentHash(rows.map(({ fetched_at: _fetchedAt, ...row }) => row));
  console.log("economic_rows_normalized", {
    correlationId,
    source: INVESTING_METADATA_SOURCE,
    fetched: events.length,
    normalized: rows.length
  });

  if (!supabase.ok)
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: true,
      contentHash,
      persisted: false,
      error: supabase.message,
      meta: {
        dates: uniqueDateKeys,
        fetches: fetchMeta,
        rowsFetched: events.length,
        rowsNormalized: rows.length,
        rowsUpserted: 0,
        rowsVerified: 0
      }
    });

  try {
    const providerRawRows = fetchMeta.reduce((total, item) => {
      const diagnostics = item.diagnostics as Record<string, unknown> | undefined;
      return total + (typeof diagnostics?.rawRows === "number" ? diagnostics.rawRows : 0);
    }, 0);
    if (providerRawRows > 0 && rows.length === 0)
      throw new Error(
        `Investing.com returned ${providerRawRows} raw rows but zero rows normalized; existing cache preserved.`
      );
    const { data: metadata } = await supabase.client
      .from("data_refresh_metadata")
      .select("content_hash")
      .eq("source", INVESTING_METADATA_SOURCE)
      .maybeSingle();
    const changed = metadata?.content_hash !== contentHash;
    let upserted = 0;
    if (rows.length) {
      const { error } = await supabase.client
        .from("investing_economic_events")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase economic events upsert failed: ${error.message}`);
      upserted = rows.length;
    }
    console.log("economic_rows_upserted", { correlationId, upserted });
    let verifiedRows: UnknownRecord[] = [];
    if (rows.length) {
      const earliest = rows.map((row) => String(row.event_date)).sort()[0];
      const latest = rows
        .map((row) => String(row.event_date))
        .sort()
        .at(-1)!;
      const { data: verified, error: verifyError } = await supabase.client
        .from("investing_economic_events")
        .select(
          "id,event_id,event_name,event_date,importance,stars,actual,forecast,previous,fetched_at"
        )
        .gte("event_date", earliest)
        .lte("event_date", latest);
      if (verifyError)
        throw new Error(`Supabase economic events verification failed: ${verifyError.message}`);
      const expectedIds = new Set(rows.map((row) => row.id));
      verifiedRows = (verified ?? []).filter((row) => expectedIds.has(row.id)) as UnknownRecord[];
      if (verifiedRows.length !== rows.length)
        throw new Error(
          `Supabase economic events verification mismatch: expected ${rows.length}, read ${verifiedRows.length}`
        );
    }
    const persisted = rows.length > 0 && verifiedRows.length === rows.length;
    const diagnostics = {
      dates: uniqueDateKeys,
      fetches: fetchMeta,
      rowsFetched: events.length,
      rowsNormalized: rows.length,
      rowsUpserted: upserted,
      rowsVerified: verifiedRows.length,
      persisted
    };
    console.log("economic_rows_verified", {
      correlationId,
      rowsVerified: verifiedRows.length,
      persisted
    });
    await updateRefreshMetadata(supabase.client, INVESTING_METADATA_SOURCE, {
      ok: true,
      changed,
      rowCount: rows.length,
      contentHash,
      meta: diagnostics
    });
    console.log("economic_refresh_completed", {
      correlationId,
      source: INVESTING_METADATA_SOURCE,
      upserted,
      rowsVerified: verifiedRows.length,
      persisted,
      changed,
      elapsedMs: Date.now() - refreshStarted
    });
    return sourceResult({
      ok: true,
      count: rows.length,
      changed,
      contentHash,
      upserted,
      persisted,
      meta: diagnostics
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
    console.error("economic_refresh_failed", {
      correlationId,
      source: INVESTING_METADATA_SOURCE,
      error: message,
      elapsedMs: Date.now() - refreshStarted
    });
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: null,
      contentHash,
      error: message,
      persisted: false,
      meta: { dates: uniqueDateKeys }
    });
  }
}

export function economicRefreshDateKeysFromParams(params: URLSearchParams) {
  const date = params.get("date");
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return [buildInvestingEconomicCalendarWeekRange(date).startDate];
  }
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
    .select(
      "id,event_id,event_key,event_name,event_date,event_time,importance,stars,actual,forecast,previous,is_highlighted,highlight_reason,fetched_at"
    )
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
