import { createServerSupabaseClient } from "@/lib/db/supabase";

export const CBOE_PUT_CALL_SOURCE_URL =
  "https://www.cboe.com/markets/us/options/market-statistics#current";
export const CBOE_SOURCE_TIMEZONE = "America/Chicago";
export const CBOE_DISPLAY_TIMEZONE = "America/New_York";

export type CboePutCallObservation = {
  externalId: string;
  ratioType: "total";
  value: number;
  sourceTimezone: typeof CBOE_SOURCE_TIMEZONE;
  displayTimezone: typeof CBOE_DISPLAY_TIMEZONE;
  sourceAsOfCentral: string | null;
  asOfEastern: string | null;
  scrapedAt: string;
  sourceName: "Cboe Options Market Statistics";
  sourceUrl: string;
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
  const localDate = parseLocalDate(dateKey);
  const localTime = parseTimeLabel(timeLabel);
  if (!localDate || !localTime) return null;
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

function numberFromText(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseCboePutCallFromHtml(
  html: string,
  scrapedAt = new Date().toISOString()
): CboePutCallObservation | null {
  const text = cleanText(html);
  const dateHeading =
    /Cboe Exchange Market Statistics for\s+([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i.exec(text);
  const asOfDate = dateHeading ? new Date(`${dateHeading[1]} 12:00:00Z`) : new Date(scrapedAt);
  const dateKey = asOfDate.toISOString().slice(0, 10);
  const row =
    /(?:^|\s)(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+Total\s+[\d,]+\s+[\d,]+\s+[\d,]+\s+([\d.]+)/i.exec(
      text
    );
  if (!row) return null;
  const value = numberFromText(row[2]);
  if (value === null) return null;
  const sourceAsOfCentral = sourceCentralLabel(dateKey, row[1]);
  const asOfEastern = centralTimestampToEasternIso(dateKey, row[1]);
  if (!sourceAsOfCentral || !asOfEastern) return null;
  return {
    externalId: `cboe-total-put-call:${asOfEastern}`,
    ratioType: "total",
    value,
    sourceTimezone: CBOE_SOURCE_TIMEZONE,
    displayTimezone: CBOE_DISPLAY_TIMEZONE,
    sourceAsOfCentral,
    asOfEastern,
    scrapedAt,
    sourceName: "Cboe Options Market Statistics",
    sourceUrl: CBOE_PUT_CALL_SOURCE_URL
  };
}

export function isExpectedCboeFetchWindow(now = new Date()) {
  const central = partsInZone(now, CBOE_SOURCE_TIMEZONE);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CBOE_SOURCE_TIMEZONE,
    weekday: "short"
  }).format(now);
  if (["Sat", "Sun"].includes(weekday)) return false;
  return (central.minute === 5 || central.minute === 35) && central.hour >= 9 && central.hour <= 15;
}

export async function fetchCboePutCallRatio() {
  try {
    const response = await fetch(CBOE_PUT_CALL_SOURCE_URL, {
      cache: "no-store",
      headers: { "user-agent": "AlphaDigest/1.0", accept: "text/html" }
    });
    if (!response.ok) throw new Error(`Cboe responded ${response.status}`);
    const parsed = parseCboePutCallFromHtml(await response.text());
    if (!parsed) throw new Error("Unable to parse Cboe intraday Total P/C Ratio");
    return { observation: parsed, mode: "live" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Cboe put/call fetch error";
    console.error("cboe_put_call_error", { error: message });
    return { observation: null, mode: "unavailable" as const, message };
  }
}

export async function refreshCboePutCallRatio() {
  const result = await fetchCboePutCallRatio();
  if (!result.observation)
    return { ok: false, upserted: 0, observation: null, error: result.message };
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return {
      ok: true,
      upserted: 0,
      persisted: false,
      observation: result.observation,
      error: supabase.message
    };
  const row = {
    external_id: result.observation.externalId,
    ratio_type: "total",
    value: result.observation.value,
    as_of_date: result.observation.asOfEastern?.slice(0, 10) ?? null,
    source_timezone: result.observation.sourceTimezone,
    display_timezone: result.observation.displayTimezone,
    source_as_of_central: result.observation.sourceAsOfCentral,
    as_of_eastern: result.observation.asOfEastern,
    scraped_at: result.observation.scrapedAt,
    source_name: result.observation.sourceName,
    source_url: result.observation.sourceUrl,
    fetched_at: result.observation.scrapedAt,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.client
    .from("put_call_observations")
    .upsert(row, { onConflict: "external_id" });
  if (error)
    return {
      ok: false,
      upserted: 0,
      persisted: true,
      observation: result.observation,
      error: error.message
    };
  return { ok: true, upserted: 1, persisted: true, observation: result.observation };
}

export async function getLatestCboePutCallRatio() {
  const supabase = createServerSupabaseClient();
  if (supabase.ok) {
    const { data, error } = await supabase.client
      .from("put_call_observations")
      .select("*")
      .eq("ratio_type", "total")
      .order("as_of_eastern", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      const asOfEastern = String(data.as_of_eastern ?? data.eastern_timestamp ?? data.fetched_at);
      return {
        observation: {
          externalId: String(data.external_id),
          ratioType: "total" as const,
          value: Number(data.value),
          sourceTimezone: String(data.source_timezone ?? CBOE_SOURCE_TIMEZONE) as typeof CBOE_SOURCE_TIMEZONE,
          displayTimezone: String(data.display_timezone ?? CBOE_DISPLAY_TIMEZONE) as typeof CBOE_DISPLAY_TIMEZONE,
          sourceAsOfCentral:
            typeof data.source_as_of_central === "string"
              ? data.source_as_of_central
              : typeof data.cboe_timestamp === "string"
                ? data.cboe_timestamp
                : null,
          asOfEastern,
          scrapedAt: String(data.scraped_at ?? data.fetched_at),
          sourceName: "Cboe Options Market Statistics" as const,
          sourceUrl: String(data.source_url ?? CBOE_PUT_CALL_SOURCE_URL)
        },
        mode: "cached" as const,
        message: undefined
      };
    }
  }
  return fetchCboePutCallRatio();
}
