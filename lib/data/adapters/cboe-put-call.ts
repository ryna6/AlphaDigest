import { createServerSupabaseClient } from "@/lib/db/supabase";

export const CBOE_PUT_CALL_SOURCE_URL =
  "https://www.cboe.com/markets/us/options/market-statistics#current";
const CBOE_DAILY_URL = "https://www.cboe.com/markets/us/options/market-statistics/daily/";
const CENTRAL = "America/Chicago";
const EASTERN = "America/New_York";

export type CboePutCallObservation = {
  externalId: string;
  ratioType: "total";
  value: number;
  cboeTimestamp: string;
  easternTimestamp: string;
  fetchedAt: string;
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

export function centralTimestampToEasternIso(dateKey: string, timeLabel: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(timeLabel);
  if (!dateMatch || !timeMatch) return null;
  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  const utc = zonedTimeToUtc(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    hour,
    minute,
    CENTRAL
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
  fetchedAt = new Date().toISOString()
): CboePutCallObservation | null {
  const text = cleanText(html);
  const dateHeading =
    /Cboe Exchange Market Statistics for\s+([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i.exec(text);
  const asOfDate = dateHeading ? new Date(`${dateHeading[1]} 12:00:00Z`) : new Date(fetchedAt);
  const dateKey = asOfDate.toISOString().slice(0, 10);
  const row =
    /(?:^|\s)(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+Total\s+[\d,]+\s+[\d,]+\s+[\d,]+\s+([\d.]+)/i.exec(
      text
    );
  const daily = /TOTAL PUT\/CALL RATIO\s+([\d.]+)/i.exec(text);
  const value = numberFromText(row?.[2] ?? daily?.[1] ?? "");
  if (value === null) return null;
  const easternTimestamp = row
    ? centralTimestampToEasternIso(dateKey, row[1])
    : asOfDate.toISOString();
  if (!easternTimestamp) return null;
  const cboeTimestamp = row ? `${dateKey} ${row[1]} ${CENTRAL}` : `${dateKey} ${CENTRAL}`;
  return {
    externalId: `cboe-total-put-call:${easternTimestamp}`,
    ratioType: "total",
    value,
    cboeTimestamp,
    easternTimestamp,
    fetchedAt,
    sourceName: "Cboe Options Market Statistics",
    sourceUrl: CBOE_PUT_CALL_SOURCE_URL
  };
}

export function isExpectedCboeFetchWindow(now = new Date()) {
  const p = partsInZone(now, EASTERN);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short" }).format(
    now
  );
  if (["Sat", "Sun"].includes(weekday)) return false;
  return (p.minute === 5 || p.minute === 35) && p.hour >= 10 && p.hour <= 17;
}

export async function fetchCboePutCallRatio() {
  try {
    const response = await fetch(CBOE_PUT_CALL_SOURCE_URL, {
      cache: "no-store",
      headers: { "user-agent": "AlphaDigest/1.0", accept: "text/html" }
    });
    const html = response.ok
      ? await response.text()
      : await (
          await fetch(CBOE_DAILY_URL, {
            cache: "no-store",
            headers: { "user-agent": "AlphaDigest/1.0" }
          })
        ).text();
    const parsed = parseCboePutCallFromHtml(html);
    if (!parsed) throw new Error("Unable to parse Cboe Total P/C Ratio");
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
    as_of_date: result.observation.easternTimestamp.slice(0, 10),
    cboe_timestamp: result.observation.cboeTimestamp,
    eastern_timestamp: result.observation.easternTimestamp,
    source_name: result.observation.sourceName,
    source_url: result.observation.sourceUrl,
    fetched_at: result.observation.fetchedAt,
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
      .order("eastern_timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data)
      return {
        observation: {
          externalId: String(data.external_id),
          ratioType: "total" as const,
          value: Number(data.value),
          cboeTimestamp: String(data.cboe_timestamp ?? data.as_of_date),
          easternTimestamp: String(data.eastern_timestamp ?? data.fetched_at),
          fetchedAt: String(data.fetched_at),
          sourceName: "Cboe Options Market Statistics" as const,
          sourceUrl: String(data.source_url ?? CBOE_PUT_CALL_SOURCE_URL)
        },
        mode: "cached" as const,
        message: undefined
      };
  }
  return fetchCboePutCallRatio();
}
