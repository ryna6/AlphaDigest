import { createServerSupabaseClient } from "@/lib/db/supabase";
import { payloadContentHash, updateRefreshMetadata } from "./supabase-refresh";
import { recordMarketSummaryHistory } from "../market-summary-history";

export const CBOE_PUT_CALL_SOURCE_URL =
  "https://www.cboe.com/markets/us/options/market-statistics#current";
export const CBOE_DAILY_PUT_CALL_SOURCE_URL =
  "https://www.cboe.com/markets/us/options/market-statistics/daily/";
export const CBOE_SOURCE_TIMEZONE = "America/Chicago";
export const CBOE_DISPLAY_TIMEZONE = "America/Toronto";
const FRESH_CACHE_MS = 35 * 60 * 1000;

export function torontoDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CBOE_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function cboeDailyPutCallUrl(now = new Date()) {
  const url = new URL(CBOE_DAILY_PUT_CALL_SOURCE_URL);
  url.searchParams.set("dt", torontoDateKey(now));
  return url.toString();
}

type PutCallRatios = { equity: number | null; index: number | null; total: number | null };
type PutCallSource = "cboe" | "supabase_cache" | "fixture" | "unavailable";
type PutCallFreshness =
  | "live_intraday"
  | "delayed"
  | "previous_close"
  | "stale"
  | "fixture"
  | "unavailable";

export type PutCallRatioResponse = {
  asOf: string | null;
  marketDate: string | null;
  source: PutCallSource;
  freshness: PutCallFreshness;
  ratios: PutCallRatios;
  value: number | null;
  raw?: {
    heading?: string;
    sourceUrl?: string;
    sourceTimezone?: typeof CBOE_SOURCE_TIMEZONE;
    displayTimezone?: typeof CBOE_DISPLAY_TIMEZONE;
    sourceAsOfCentral?: string | null;
    asOfEastern?: string | null;
    latestTimesCentral?: Partial<Record<keyof PutCallRatios, string>>;
    scrapedAt?: string;
  };
};

const unavailableResponse: PutCallRatioResponse = {
  asOf: null,
  marketDate: null,
  source: "unavailable",
  freshness: "unavailable",
  ratios: { equity: null, index: null, total: null },
  value: null,
  raw: {
    sourceUrl: CBOE_PUT_CALL_SOURCE_URL,
    sourceTimezone: CBOE_SOURCE_TIMEZONE,
    displayTimezone: CBOE_DISPLAY_TIMEZONE,
    sourceAsOfCentral: null,
    asOfEastern: null
  }
};

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  for (let i = 0; i < 3; i += 1) {
    const p = partsInZone(utc, timeZone);
    const diff =
      Date.UTC(year, month - 1, day, hour, minute) -
      Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    utc = new Date(utc.getTime() + diff);
  }
  return utc;
}

function parseLocalDate(dateKey: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!dateMatch) return null;
  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3])
  };
}

function parseTimeLabel(timeLabel: string) {
  const timeMatch = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(timeLabel);
  if (!timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function sourceCentralLabel(dateKey: string, timeLabel: string) {
  const localTime = parseTimeLabel(timeLabel);
  if (!parseLocalDate(dateKey) || !localTime) return null;
  return `${dateKey}T${pad(localTime.hour)}:${pad(localTime.minute)}:00[${CBOE_SOURCE_TIMEZONE}]`;
}

export function centralTimestampToEasternIso(dateKey: string, timeLabel: string) {
  const localDate = parseLocalDate(dateKey);
  const localTime = parseTimeLabel(timeLabel);
  if (!localDate || !localTime) return null;
  const utc = zonedTimeToUtc(
    localDate.year,
    localDate.month,
    localDate.day,
    localTime.hour,
    localTime.minute,
    CBOE_SOURCE_TIMEZONE
  );
  return utc.toISOString();
}

function cleanText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cellText(html: string) {
  return cleanText(html).replace(/%$/, "").trim();
}

function numberFromText(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[,%\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z]/g, "");
}

function ratioKeyFromLabel(value: string): keyof PutCallRatios | null {
  const normalized = normalizeLabel(value);
  if (normalized === "total" || normalized === "totaloptions") return "total";
  if (normalized === "index" || normalized === "indexoptions") return "index";
  if (normalized === "equity" || normalized === "equityoptions") return "equity";
  return null;
}

function sectionAfterMarketStatsHeading(html: string) {
  const headingPattern =
    /<h[1-6][^>]*>\s*Cboe Exchange Market Statistics for\s+([\s\S]*?)<\/h[1-6]>/i;
  const headingMatch = headingPattern.exec(html);
  if (!headingMatch || headingMatch.index === undefined) return null;
  const afterHeading = html.slice(headingMatch.index);
  const headingLevel = Number(/<h([1-6])/i.exec(headingMatch[0])?.[1] ?? 6);
  const nextPeerHeadingPattern = new RegExp(`<h[1-${headingLevel}][^>]*>`, "i");
  const nextHeading = afterHeading.slice(headingMatch[0].length).search(nextPeerHeadingPattern);
  const sectionHtml =
    nextHeading >= 0 ? afterHeading.slice(0, headingMatch[0].length + nextHeading) : afterHeading;
  return { heading: cellText(headingMatch[0]), sectionHtml };
}

function extractDateKeyFromHeading(heading: string, scrapedAt: string) {
  const dateHeading = /Cboe Exchange Market Statistics for\s+(.+)$/i.exec(heading);
  const asOfDate = dateHeading ? new Date(`${dateHeading[1]} 12:00:00Z`) : new Date(scrapedAt);
  return Number.isNaN(asOfDate.getTime())
    ? scrapedAt.slice(0, 10)
    : asOfDate.toISOString().slice(0, 10);
}

function cellsFromRow(rowHtml: string) {
  return Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((match) =>
    cellText(match[1])
  );
}

function extractTableLabel(sectionHtml: string, tableStart: number, tableHtml?: string) {
  const caption = tableHtml?.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1];
  const captionKey = caption ? ratioKeyFromLabel(cellText(caption)) : null;
  if (captionKey) return captionKey;

  const before = sectionHtml.slice(Math.max(0, tableStart - 1200), tableStart);
  const labels = Array.from(
    before.matchAll(/<(?:h[1-6]|caption|p|div|span)[^>]*>([\s\S]*?)<\/(?:h[1-6]|caption|p|div|span)>/gi)
  ).map((match) => cellText(match[1]));
  return labels.reverse().map(ratioKeyFromLabel).find(Boolean) ?? null;
}

function rowTimeMillis(dateKey: string, timeLabel: string) {
  const iso = centralTimestampToEasternIso(dateKey, timeLabel);
  const time = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

function parseRatiosFromCurrentTables(sectionHtml: string, marketDate: string) {
  const ratios: PutCallRatios = { equity: null, index: null, total: null };
  const latestTimes: Partial<Record<keyof PutCallRatios, string>> = {};
  const labelsFound: string[] = [];
  const candidates: Array<{
    key: keyof PutCallRatios | null;
    latest: { timeLabel: string; value: number | null; time: number | null };
  }> = [];
  const tables = Array.from(sectionHtml.matchAll(/<table[^>]*class=["'][^"']*data-table[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi));

  for (const table of tables) {
    const tableHtml = table[1];
    const rows = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) =>
      cellsFromRow(match[1])
    );
    const header = rows.find((cells) =>
      cells.some((cell) => /^time$/i.test(cell.trim())) && cells.some((cell) => /p\s*\/\s*c\s*ratio/i.test(cell))
    );
    if (!header) continue;
    const timeIndex = header.findIndex((cell) => /^time$/i.test(cell.trim()));
    const ratioIndex = header.findIndex((cell) => /p\s*\/\s*c\s*ratio/i.test(cell));
    if (timeIndex < 0 || ratioIndex < 0) continue;

    const latest = rows
      .filter((cells) => cells !== header && cells.length > Math.max(timeIndex, ratioIndex))
      .map((cells) => ({
        timeLabel: cells[timeIndex],
        value: numberFromText(cells[ratioIndex]),
        time: rowTimeMillis(marketDate, cells[timeIndex])
      }))
      .filter((row) => row.value !== null && row.time !== null)
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))[0];
    if (!latest) continue;
    const key = extractTableLabel(sectionHtml, table.index ?? 0, table[0]);
    candidates.push({ key, latest });
  }

  const unlabeled = candidates.filter((candidate) => !candidate.key);
  const orderedFallbackKeys: Array<keyof PutCallRatios> = ["total", "index", "equity"];
  for (const [index, candidate] of candidates.entries()) {
    const key =
      candidate.key ??
      (unlabeled.length === candidates.length && candidates.length >= 3
        ? orderedFallbackKeys[index]
        : null);
    if (!key || ratios[key] !== null) continue;
    const latest = candidate.latest;
    ratios[key] = latest.value;
    latestTimes[key] = latest.timeLabel;
    labelsFound.push(candidate.key ? key : `${key}:inferred_by_table_order`);
  }

  return { ratios, labelsFound, latestTimes };
}

function parseRatiosFromLegacySection(sectionHtml: string) {
  const ratios: PutCallRatios = { equity: null, index: null, total: null };
  const labelsFound: string[] = [];
  const rows = Array.from(sectionHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) =>
    cellsFromRow(match[1])
  );
  const header = rows.find((cells) => cells.some((cell) => /p\/?c\s*ratio/i.test(cell)));
  const ratioIndex = header?.findIndex((cell) => /p\/?c\s*ratio/i.test(cell)) ?? -1;

  for (const cells of rows) {
    if (!cells.length || cells === header) continue;
    const key = cells.map(ratioKeyFromLabel).find(Boolean) ?? null;
    if (!key) continue;
    labelsFound.push(cells.find((cell) => ratioKeyFromLabel(cell) === key) ?? key);
    const value = numberFromText(cells[ratioIndex >= 0 ? ratioIndex : cells.length - 1]);
    ratios[key] = value;
  }

  return { ratios, labelsFound, latestTimes: {} as Partial<Record<keyof PutCallRatios, string>> };
}

function anyRatio(ratios: PutCallRatios) {
  return Object.values(ratios).some((value) => typeof value === "number" && Number.isFinite(value));
}

function countDataTables(html: string) {
  return (html.match(/<table[^>]*class=["'][^"']*data-table[^"']*["'][^>]*>/gi) ?? []).length;
}

function nearbyLabels(html: string) {
  return Array.from(
    html.matchAll(/<(?:h[1-6]|caption)[^>]*>([\s\S]*?)<\/(?:h[1-6]|caption)>/gi)
  )
    .map((match) => cellText(match[1]))
    .filter(Boolean)
    .slice(0, 12);
}

function diagnosticSnippet(html: string) {
  const lower = html.toLowerCase();
  const index = ["p/c ratio", "index options", "equity options", "total", "data-table"]
    .map((needle) => lower.indexOf(needle))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0];
  if (index === undefined) return null;
  return cleanText(html.slice(Math.max(0, index - 240), Math.min(html.length, index + 360))).slice(
    0,
    500
  );
}

function logParserDiagnostics(event: string, html: string, extra: Record<string, unknown> = {}) {
  console.log(event, {
    responseLength: html.length,
    dataTableCount: countDataTables(html),
    nearbyLabels: nearbyLabels(html),
    snippet: diagnosticSnippet(html),
    ...extra
  });
}

function firstTimeLabel(text: string) {
  return /(\d{1,2}:\d{2}\s*(?:AM|PM))/i.exec(text)?.[1] ?? null;
}


function ratioKeyFromDailyLabel(value: string): keyof PutCallRatios | null {
  const normalized = normalizeLabel(value.replace(/put\/?callratio/gi, ""));
  if (normalized === "total") return "total";
  if (normalized === "index") return "index";
  if (normalized === "equity") return "equity";
  return null;
}

function parseDailyRatiosFromText(text: string) {
  const ratios: PutCallRatios = { equity: null, index: null, total: null };
  const labelsFound: string[] = [];
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const patterns: Array<[keyof PutCallRatios, RegExp]> = [
    ["total", /\bTOTAL\s+PUT\/?CALL\s+RATIO\s+([0-9]+(?:\.[0-9]+)?)/i],
    ["index", /\bINDEX\s+PUT\/?CALL\s+RATIO\s+([0-9]+(?:\.[0-9]+)?)/i],
    ["equity", /\bEQUITY\s+PUT\/?CALL\s+RATIO\s+([0-9]+(?:\.[0-9]+)?)/i]
  ];

  for (const [key, pattern] of patterns) {
    const match = pattern.exec(normalizedText);
    if (!match) continue;
    labelsFound.push(`${key} put/call ratio`);
    ratios[key] = numberFromText(match[1]);
  }

  return { ratios, labelsFound };
}

function parseDailyRatiosFromTable(html: string) {
  const ratios: PutCallRatios = { equity: null, index: null, total: null };
  const labelsFound: string[] = [];
  const rows = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) =>
    cellsFromRow(match[1])
  );

  for (const cells of rows) {
    if (cells.length < 2) continue;
    const key = ratioKeyFromDailyLabel(cells[0]);
    if (!key) continue;
    labelsFound.push(cells[0]);
    ratios[key] = numberFromText(cells[1]);
  }

  return anyRatio(ratios) ? { ratios, labelsFound } : parseDailyRatiosFromText(cleanText(html));
}

export function parseCboeDailyPutCallFromHtml(
  html: string,
  scrapedAt = new Date().toISOString(),
  sourceUrl = CBOE_DAILY_PUT_CALL_SOURCE_URL
): PutCallRatioResponse | null {
  const { ratios, labelsFound } = parseDailyRatiosFromTable(html);
  const parsedKeys = presentRatioKeys(ratios);
  if (!anyRatio(ratios)) {
    logParserDiagnostics("cboe_put_call_daily_parse", html, { labelsFound, parsedKeys });
    return null;
  }
  console.log("cboe_put_call_daily_parse", { labelsFound, parsedKeys });
  const asOf = new Date(scrapedAt).toISOString();
  return {
    asOf,
    marketDate: asOf.slice(0, 10),
    source: "cboe",
    freshness: "previous_close",
    ratios,
    value: ratios.total,
    raw: {
      heading: "Cboe Daily Market Statistics",
      sourceUrl,
      sourceTimezone: CBOE_SOURCE_TIMEZONE,
      displayTimezone: CBOE_DISPLAY_TIMEZONE,
      sourceAsOfCentral: null,
      asOfEastern: asOf,
      scrapedAt
    }
  };
}

export function parseCboePutCallFromHtml(
  html: string,
  scrapedAt = new Date().toISOString(),
  sourceUrl = CBOE_PUT_CALL_SOURCE_URL
): PutCallRatioResponse | null {
  const section = sectionAfterMarketStatsHeading(html);
  const targetHtml = section?.sectionHtml ?? html;
  const heading = section?.heading ?? "Cboe Exchange Market Statistics";
  const marketDate = section ? extractDateKeyFromHeading(section.heading, scrapedAt) : torontoDateKey(new Date(scrapedAt));
  const currentTables = parseRatiosFromCurrentTables(targetHtml, marketDate);
  const { ratios, labelsFound, latestTimes } = anyRatio(currentTables.ratios)
    ? currentTables
    : section
      ? parseRatiosFromLegacySection(section.sectionHtml)
      : {
          ratios: currentTables.ratios,
          labelsFound: currentTables.labelsFound,
          latestTimes: currentTables.latestTimes
        };
  const parsedKeys = Object.entries(ratios)
    .filter(([, value]) => value !== null)
    .map(([key]) => key);
  const timeLabel = latestTimes.total ?? latestTimes.index ?? latestTimes.equity ?? firstTimeLabel(cleanText(targetHtml));
  const sourceAsOfCentral = timeLabel ? sourceCentralLabel(marketDate, timeLabel) : null;
  const asOfEastern = timeLabel ? centralTimestampToEasternIso(marketDate, timeLabel) : null;

  const logDetails = {
    sectionFound: Boolean(section),
    labelsFound,
    parsedKeys,
    sourceAsOfCentral,
    asOfEastern
  };

  if (!anyRatio(ratios)) {
    logParserDiagnostics("cboe_put_call_parse", html, logDetails);
    return null;
  }

  console.log("cboe_put_call_parse", logDetails);

  return {
    asOf: asOfEastern,
    marketDate,
    source: "cboe",
    freshness: "live_intraday",
    ratios,
    value: ratios.total,
    raw: {
      heading,
      sourceUrl,
      sourceTimezone: CBOE_SOURCE_TIMEZONE,
      displayTimezone: CBOE_DISPLAY_TIMEZONE,
      sourceAsOfCentral,
      asOfEastern,
      latestTimesCentral: latestTimes,
      scrapedAt
    }
  };
}

export function isExpectedCboeFetchWindow(now = new Date()) {
  const central = partsInZone(now, CBOE_SOURCE_TIMEZONE);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CBOE_SOURCE_TIMEZONE,
    weekday: "short"
  }).format(now);
  if (["Sat", "Sun"].includes(weekday)) return false;
  return (central.minute === 0 || central.minute === 30 || (central.hour === 15 && central.minute === 15)) && central.hour >= 9 && central.hour <= 15;
}

function isFreshCachedResponse(response: PutCallRatioResponse, now = Date.now()) {
  const scrapedAt = response.raw?.scrapedAt ? new Date(response.raw.scrapedAt).getTime() : NaN;
  return Number.isFinite(scrapedAt) && now - scrapedAt <= FRESH_CACHE_MS;
}

function presentRatioKeys(ratios: PutCallRatios) {
  return Object.entries(ratios)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([key]) => key);
}

function dbRowFromResponse(response: PutCallRatioResponse) {
  return {
    external_id: `cboe-put-call:${response.asOf ?? response.raw?.scrapedAt ?? new Date().toISOString()}`,
    ratio_type: "options",
    value: response.ratios.total,
    equity_ratio: response.ratios.equity,
    index_ratio: response.ratios.index,
    total_ratio: response.ratios.total,
    market_date: response.marketDate,
    as_of_date: response.marketDate,
    source_timezone: response.raw?.sourceTimezone,
    display_timezone: response.raw?.displayTimezone,
    source_as_of_central: response.raw?.sourceAsOfCentral,
    as_of_eastern: response.asOf,
    scraped_at: response.raw?.scrapedAt,
    freshness: response.freshness,
    source_name: "Cboe Options Market Statistics",
    source_url: response.raw?.sourceUrl ?? CBOE_PUT_CALL_SOURCE_URL,
    fetched_at: response.raw?.scrapedAt ?? new Date().toISOString(),
    raw: response.raw ?? null,
    updated_at: new Date().toISOString()
  };
}

function responseFromDbRow(
  row: Record<string, unknown>,
  freshness: PutCallFreshness
): PutCallRatioResponse {
  const ratios = {
    equity: numberFromText(String(row.equity_ratio ?? "")),
    index: numberFromText(String(row.index_ratio ?? "")),
    total: numberFromText(String(row.total_ratio ?? row.value ?? ""))
  };
  const asOf = typeof row.as_of_eastern === "string" ? row.as_of_eastern : null;
  return {
    asOf,
    marketDate:
      typeof row.market_date === "string"
        ? row.market_date
        : typeof row.as_of_date === "string"
          ? row.as_of_date
          : null,
    source: "supabase_cache",
    freshness,
    ratios,
    value: ratios.total,
    raw: {
      sourceUrl: typeof row.source_url === "string" ? row.source_url : CBOE_PUT_CALL_SOURCE_URL,
      sourceTimezone: CBOE_SOURCE_TIMEZONE,
      displayTimezone: CBOE_DISPLAY_TIMEZONE,
      sourceAsOfCentral:
        typeof row.source_as_of_central === "string" ? row.source_as_of_central : null,
      asOfEastern: asOf,
      latestTimesCentral:
        row.raw && typeof row.raw === "object" && "latestTimesCentral" in row.raw
          ? (row.raw as { latestTimesCentral?: Partial<Record<keyof PutCallRatios, string>> }).latestTimesCentral
          : undefined,
      scrapedAt:
        typeof row.scraped_at === "string"
          ? row.scraped_at
          : typeof row.fetched_at === "string"
            ? row.fetched_at
            : undefined
    }
  };
}

async function readCachedPutCallRatio(freshness: PutCallFreshness) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { response: null, message: supabase.message };
  const { data, error } = await supabase.client
    .from("put_call_observations")
    .select("*")
    .eq("ratio_type", "options")
    .order("as_of_eastern", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    console.log("cboe_put_call_cache", { hit: false, freshness, error: error?.message });
    return { response: null, message: error ? error.message : "No cached Cboe put/call rows." };
  }
  const response = responseFromDbRow(data as Record<string, unknown>, freshness);
  console.log("cboe_put_call_cache", {
    hit: true,
    freshness,
    presentRatios: presentRatioKeys(response.ratios),
    asOf: response.asOf,
    scrapedAt: response.raw?.scrapedAt
  });
  return {
    response,
    message: undefined
  };
}

async function writeCachedPutCallRatio(response: PutCallRatioResponse) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { persisted: false, error: supabase.message };
  const row = dbRowFromResponse(response);
  const { error } = await supabase.client
    .from("put_call_observations")
    .upsert(row, { onConflict: "external_id" });
  if (!error) {
    const history = await recordMarketSummaryHistory([
      {
        metricKey: "put_call_total",
        value: response.ratios.total,
        observedAt: response.asOf,
        source: "Cboe Options Market Statistics",
        freshness: response.freshness
      },
      {
        metricKey: "put_call_index",
        value: response.ratios.index,
        observedAt: response.asOf,
        source: "Cboe Options Market Statistics",
        freshness: response.freshness
      },
      {
        metricKey: "put_call_equity",
        value: response.ratios.equity,
        observedAt: response.asOf,
        source: "Cboe Options Market Statistics",
        freshness: response.freshness
      }
    ]);
    if (!history.ok && history.error) {
      console.error("put_call_history_error", { error: history.error });
    }
    try {
      await updateRefreshMetadata(supabase.client, "put_call_observations", {
        ok: true,
        changed: true,
        rowCount: 1,
        contentHash: payloadContentHash([row]),
        error: null,
        meta: { functionName: "refresh-put-call", source: "cboe", asOf: response.asOf ?? null }
      });
    } catch (metadataError) {
      console.error("cboe_put_call_metadata_error", { error: metadataError instanceof Error ? metadataError.message : "Unknown metadata error" });
    }
  }
  return { persisted: !error, error: error?.message };
}

export async function fetchCboePutCallRatio() {
  const attempts = [
    {
      url: CBOE_PUT_CALL_SOURCE_URL,
      parse: parseCboePutCallFromHtml,
      label: "intraday_exchange_market_statistics"
    },
    {
      url: cboeDailyPutCallUrl(),
      parse: parseCboeDailyPutCallFromHtml,
      label: "daily_market_statistics"
    }
  ];
  const messages: string[] = [];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        cache: "no-store",
        headers: { "user-agent": "AlphaDigest/1.0", accept: "text/html" }
      });
      console.log("cboe_put_call_fetch", {
        source: attempt.label,
        ok: response.ok,
        status: response.status
      });
      if (!response.ok) throw new Error(`Cboe responded ${response.status}`);
      const scrapedAt = new Date().toISOString();
      const parsed = attempt.parse(await response.text(), scrapedAt, attempt.url);
      if (!parsed) throw new Error(`Unable to parse ${attempt.label} put/call ratios`);
      console.log("cboe_put_call_fetch_success", {
        source: attempt.label,
        presentRatios: presentRatioKeys(parsed.ratios),
        asOf: parsed.asOf,
        sourceAsOfCentral: parsed.raw?.sourceAsOfCentral
      });
      return { response: parsed, mode: "live" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Cboe put/call fetch error";
      messages.push(`${attempt.label}: ${message}`);
      console.error("cboe_put_call_error", { source: attempt.label, error: message });
    }
  }

  return { response: null, mode: "unavailable" as const, message: messages.join("; ") };
}

export async function refreshCboePutCallRatio() {
  const result = await fetchCboePutCallRatio();
  if (!result.response) {
    const supabase = createServerSupabaseClient();
    if (supabase.ok) {
      try {
        await updateRefreshMetadata(supabase.client, "put_call_observations", {
          ok: false,
          changed: null,
          rowCount: 0,
          contentHash: null,
          error: result.message ?? "Cboe put/call refresh returned no response.",
          meta: { functionName: "refresh-put-call", source: "cboe" }
        });
      } catch (metadataError) {
        console.error("cboe_put_call_metadata_error", { error: metadataError instanceof Error ? metadataError.message : "Unknown metadata error" });
      }
    }
    return { ok: false, upserted: 0, response: null, error: result.message };
  }
  const cache = await writeCachedPutCallRatio(result.response);
  console.log("cboe_put_call_refresh", {
    source: result.response.source,
    freshness: result.response.freshness,
    ratios: result.response.ratios,
    asOf: result.response.asOf,
    persisted: cache.persisted
  });
  return {
    ok: true,
    upserted: cache.persisted ? 1 : 0,
    persisted: cache.persisted,
    response: result.response,
    error: cache.error
  };
}

export async function getLatestCboePutCallRatio() {
  const cached = await readCachedPutCallRatio("live_intraday");
  if (cached.response && isFreshCachedResponse(cached.response)) {
    console.log("cboe_put_call_response", { source: "supabase_cache", freshness: "live_intraday", presentRatios: presentRatioKeys(cached.response.ratios), asOf: cached.response.asOf });
    return { response: cached.response, mode: "cached" as const, message: undefined };
  }

  const live = await fetchCboePutCallRatio();
  if (live.response) {
    const cache = await writeCachedPutCallRatio(live.response);
    if (cache.error) console.error("cboe_put_call_cache_error", { error: cache.error });
    console.log("cboe_put_call_response", { source: "cboe", freshness: "live_intraday", presentRatios: presentRatioKeys(live.response.ratios), asOf: live.response.asOf });
    return { response: live.response, mode: "live" as const, message: undefined };
  }

  if (cached.response) {
    const stale = { ...cached.response, freshness: "stale" as const };
    console.log("cboe_put_call_response", { source: "supabase_cache", freshness: "stale", presentRatios: presentRatioKeys(stale.ratios), asOf: stale.asOf });
    return { response: stale, mode: "cached" as const, message: live.message };
  }

  console.log("cboe_put_call_response", { source: "unavailable", freshness: "unavailable" });
  return { response: unavailableResponse, mode: "unavailable" as const, message: live.message };
}
