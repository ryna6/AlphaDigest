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
  country: string | null;
  fetchedAt: string;
  raw: Record<string, unknown>;
};

type FetchResult = {
  events: InvestingEconomicEvent[];
  mode: "live" | "unavailable";
  message?: string;
};

const memoryCache = new Map<string, InvestingEconomicEvent[]>();

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
    country,
    fetchedAt,
    raw: row
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
  if (isWeekendDateKey(dateKey)) {
    return { events: [], mode: "live" };
  }

  const cacheKey = buildInvestingEconomicCalendarCacheKey(dateKey);
  const cached = memoryCache.get(cacheKey);
  const url = buildInvestingEconomicCalendarUrl(dateKey);
  const fetchedAt = new Date().toISOString();

  debugEconomicCalendar("fetch", { dateKey, cacheKey, investingCalendarUrl: url });

  try {
    const payload = await fetchPayload(url);
    const events = normalizeInvestingEconomicCalendarPayload(payload, dateKey, fetchedAt).filter(
      (event) => event.eventDate === dateKey
    );
    memoryCache.set(cacheKey, events);
    debugEconomicCalendar("fetched", { dateKey, cacheKey, numberOfEventsFetched: events.length });
    return { events, mode: "live" };
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
