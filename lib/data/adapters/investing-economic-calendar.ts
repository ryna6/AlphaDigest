import { formatEtDateKey } from "@/lib/utils/time";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { ImportantEconomicEventKey } from "../config/included-economic-events";
import {
  getImportantEconomicEventKey,
  getImportantEconomicEventLabel,
  shouldIncludeEconomicEvent
} from "../config/included-economic-events";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";
import { stableHash } from "./unusual-whales-earnings";

const INVESTING_ECONOMIC_CALENDAR_ENDPOINT =
  "https://www.investing.com/economic-calendar/Service/getCalendarFilteredData";
const INVESTING_ECONOMIC_CALENDAR_PAGE = "https://www.investing.com/economic-calendar/";
const ECONOMIC_CALENDAR_TIMEOUT_MS = 12_000;
const ECONOMIC_CALENDAR_RETRIES = 2;
const FIXED_EST_TIMEZONE_ID = "55";
const PAGE_SIZE = 50;
const MAX_PAGES = 30;
const INVESTING_METADATA_SOURCE = "investing_economic_events";

type UnknownRecord = Record<string, unknown>;

type ParsedCalendarRow = {
  date: string;
  timeET: string | null;
  timeDisplay: string | null;
  key: string;
  name: string;
  importance: "medium" | "high";
  stars: 2 | 3;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  actualNumeric: number | null;
  forecastNumeric: number | null;
  previousNumeric: number | null;
  country: string | null;
};

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

type CachedEconomicResult = FetchResult & { metadata?: Record<string, unknown> | null };

const memoryCache = new Map<string, InvestingEconomicEvent[]>();

export function buildInvestingEconomicCalendarCacheKey(dateKey: string) {
  return `investing-economic:US:medium-high:${dateKey}`;
}

export function buildInvestingEconomicCalendarUrl(dateKey: string) {
  const params = new URLSearchParams({
    country: "5",
    dateFrom: dateKey,
    dateTo: dateKey,
    timeZone: FIXED_EST_TIMEZONE_ID,
    importance: "2,3"
  });
  return `${INVESTING_ECONOMIC_CALENDAR_ENDPOINT}?${params.toString()}`;
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

function cleanHtmlText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlAttribute(value: unknown) {
  return cleanHtmlText(value);
}

function getCell(rowHtml: string, cls: string) {
  return (
    (rowHtml.match(new RegExp(`<td[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`, "i")) ||
      [])[1] || ""
  );
}

function parseImportance(rowHtml: string): ParsedCalendarRow["importance"] | "low" | null {
  const fullBulls = (rowHtml.match(/grayFullBullishIcon/g) || []).length;
  if (fullBulls >= 3) return "high";
  if (fullBulls === 2) return "medium";
  if (fullBulls === 1) return "low";
  return null;
}

function parseNumericLoose(value: unknown) {
  const raw = cleanHtmlText(value);
  if (!raw || raw === "-" || raw === "." || raw === "—") return null;

  let normalized = raw.replace(/,/g, "");
  let multiplier = 1;
  if (/k$/i.test(normalized)) {
    multiplier = 1_000;
    normalized = normalized.slice(0, -1).trim();
  } else if (/m$/i.test(normalized)) {
    multiplier = 1_000_000;
    normalized = normalized.slice(0, -1).trim();
  } else if (/b$/i.test(normalized)) {
    multiplier = 1_000_000_000;
    normalized = normalized.slice(0, -1).trim();
  }

  normalized = normalized.replace(/%/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric * multiplier : null;
}

function formatAbbrevNumeric(value: number, decimals = 1) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(decimals).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(decimals).replace(/\.0$/, "")}K`;
  if (Number.isInteger(value)) return String(value);
  return value
    .toFixed(abs >= 100 ? 1 : 2)
    .replace(/\.0$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatMetricValue({ raw, numeric }: { raw: unknown; numeric: number | null }) {
  const cleanRaw = cleanHtmlText(raw);
  if (!cleanRaw || cleanRaw === "-" || cleanRaw === "." || cleanRaw === "—") return null;
  if (cleanRaw.includes("%")) return cleanRaw;
  if (/\b[KMB]\b/i.test(cleanRaw)) return cleanRaw;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return cleanRaw;
  return formatAbbrevNumeric(numeric);
}

function to12HourFrom24(time24: string | null) {
  const match = String(time24 || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${suffix}`;
}

function parseDateAndTime(dateRaw: unknown) {
  const normalized = String(dateRaw || "").trim();
  const match = normalized.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) return { date: null, timeET: null, timeDisplay: null };
  const timeET = `${match[4]}:${match[5]}`;
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    timeET,
    timeDisplay: to12HourFrom24(timeET)
  };
}

function extract24HourTime(value: unknown) {
  const normalized = cleanHtmlText(value);
  if (!normalized) return null;

  const twelveHour = normalized.match(/\b(\d{1,2}):(\d{2})\s*([AaPp][Mm])\b/);
  if (twelveHour) {
    const hour12 = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
    const hour24 = (hour12 % 12) + (twelveHour[3].toUpperCase() === "PM" ? 12 : 0);
    return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const twentyFourHour = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!twentyFourHour) return null;
  return `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`;
}

function parseEventDateTime(rowHtml: string) {
  const dateRaw = (rowHtml.match(/data-event-datetime="([^"]+)"/i) || [])[1] || "";
  const base = parseDateAndTime(dateRaw);
  if (!base.date) return base;

  const timeCell = extract24HourTime(getCell(rowHtml, "time"));
  const timeET = timeCell || base.timeET;
  return {
    date: base.date,
    timeET,
    timeDisplay: to12HourFrom24(timeET)
  };
}

function countServerRows(html: string) {
  const matches = String(html || "").match(/<tr[^>]*eventRowId[^>]*>/gi);
  return matches ? matches.length : 0;
}

function parseInvestingCalendarRows(html: string): ParsedCalendarRow[] {
  const rows: ParsedCalendarRow[] = [];
  const trRegex = /<tr[^>]*eventRowId[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = trRegex.exec(html))) {
    const rowHtml = match[0];
    const importance = parseImportance(rowHtml);
    if (importance !== "medium" && importance !== "high") continue;

    const eventName =
      decodeHtmlAttribute((rowHtml.match(/event="([^"]+)"/i) || [])[1]) ||
      cleanHtmlText(getCell(rowHtml, "event"));
    if (!eventName || !shouldIncludeEconomicEvent(eventName)) continue;

    const country = decodeHtmlAttribute(
      (rowHtml.match(/title="([^"]+)"[^>]*class="ceFlags/i) || [])[1]
    );
    if (country && country.toLowerCase() !== "united states") continue;

    const { date, timeET, timeDisplay } = parseEventDateTime(rowHtml);
    if (!date) continue;

    const rawActual = getCell(rowHtml, "act");
    const rawForecast = getCell(rowHtml, "forecast");
    const rawPrevious = getCell(rowHtml, "previous");
    const actualNumeric = parseNumericLoose(rawActual);
    const forecastNumeric = parseNumericLoose(rawForecast);
    const previousNumeric = parseNumericLoose(rawPrevious);
    const eventAttrId = (rowHtml.match(/event_attr_id="(\d+)"/i) || [])[1];

    rows.push({
      date,
      timeET,
      timeDisplay,
      key: String(eventAttrId || `${date}-${eventName}`),
      name: eventName,
      importance,
      stars: importance === "high" ? 3 : 2,
      actual: formatMetricValue({ raw: rawActual, numeric: actualNumeric }),
      forecast: formatMetricValue({ raw: rawForecast, numeric: forecastNumeric }),
      previous: formatMetricValue({ raw: rawPrevious, numeric: previousNumeric }),
      actualNumeric,
      forecastNumeric,
      previousNumeric,
      country: country || "United States"
    });
  }

  return rows;
}

function sortParsedRows(a: ParsedCalendarRow, b: ParsedCalendarRow) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const timeA = a.timeET || "99:99";
  const timeB = b.timeET || "99:99";
  if (timeA !== timeB) return timeA.localeCompare(timeB);
  return b.stars - a.stars;
}

function normalizeParsedRow(row: ParsedCalendarRow, fetchedAt: string): InvestingEconomicEvent {
  const eventId = asNumberOrString(row.key);
  const eventKey = getImportantEconomicEventKey(eventId, row.name);
  const highlightReason = getImportantEconomicEventLabel(eventKey);

  return {
    source: "investing_com",
    id: `investing-economic:${row.date}:${row.key}:${row.timeET ?? "unknown"}`,
    eventId,
    eventKey,
    eventName: row.name,
    eventDate: row.date,
    time: row.timeDisplay,
    timestamp: row.timeET,
    importance: row.importance,
    stars: row.stars,
    actual: row.actual,
    forecast: row.forecast,
    previous: row.previous,
    isHighlighted: Boolean(eventKey),
    highlightReason,
    country: row.country,
    fetchedAt,
    raw: row
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchInvestingCalendarPage(start: string, end: string, limitFrom: number) {
  const body = new URLSearchParams({
    country: "5",
    dateFrom: start,
    dateTo: end,
    timeZone: FIXED_EST_TIMEZONE_ID,
    timeFilter: "timeOnly",
    currentTab: "custom",
    submitFilters: "1",
    limit_from: String(limitFrom),
    importance: "2,3"
  });
  body.append("importance[]", "2");
  body.append("importance[]", "3");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ECONOMIC_CALENDAR_TIMEOUT_MS);
  try {
    return await fetch(INVESTING_ECONOMIC_CALENDAR_ENDPOINT, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketRecap/1.0)",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.investing.com",
        Referer: INVESTING_ECONOMIC_CALENDAR_PAGE
      },
      body: body.toString(),
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchInvestingCalendarPayload(start: string, end: string, limitFrom: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= ECONOMIC_CALENDAR_RETRIES; attempt += 1) {
    try {
      const response = await fetchInvestingCalendarPage(start, end, limitFrom);
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

async function scrapeInvestingEconomicCalendar(start: string, end: string) {
  const rows: ParsedCalendarRow[] = [];
  const seenKeys = new Set<string>();
  const seenOffsets = new Set<number>();
  let limitFrom = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (seenOffsets.has(limitFrom)) break;
    seenOffsets.add(limitFrom);

    const payload = await fetchInvestingCalendarPayload(start, end, limitFrom);
    const html = isRecord(payload) ? (asString(payload.data) ?? "") : "";
    const pageRows = parseInvestingCalendarRows(html);
    const serverRowCount = countServerRows(html);
    const beforeCount = rows.length;

    for (const row of pageRows) {
      const dedupeKey = `${row.date}:${row.timeET || ""}:${row.key}:${row.name}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      rows.push(row);
    }

    const hasMore = isRecord(payload) && Boolean(payload.bind_scroll_handler) && serverRowCount > 0;
    if (!hasMore) break;

    const fetchedNewRows = rows.length - beforeCount;
    if (fetchedNewRows === 0 && pageRows.length === 0) break;
    limitFrom += PAGE_SIZE;
  }

  return rows.sort(sortParsedRows);
}

function isWeekendDateKey(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function normalizeInvestingEconomicCalendarPayload(
  payload: unknown,
  dateKey: string,
  fetchedAt = new Date().toISOString()
) {
  const html = isRecord(payload) ? (asString(payload.data) ?? "") : "";
  return parseInvestingCalendarRows(html)
    .filter((row) => row.date === dateKey)
    .sort(sortParsedRows)
    .map((row) => normalizeParsedRow(row, fetchedAt));
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
    const events = (await scrapeInvestingEconomicCalendar(dateKey, dateKey))
      .filter((row) => row.date === dateKey)
      .map((row) => normalizeParsedRow(row, fetchedAt));
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
    isHighlighted: Boolean(row.is_highlighted),
    highlightReason: asString(row.highlight_reason),
    country: asString(row.country),
    fetchedAt: asString(row.fetched_at) ?? new Date().toISOString(),
    raw: isRecord(row.raw) ? row.raw : {}
  };
}

function starsFromImportance(importance: string | null): 1 | 2 | 3 | null {
  if (importance === "high") return 3;
  if (importance === "medium") return 2;
  if (importance === "low") return 1;
  return null;
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
