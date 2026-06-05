import type { EarningsEvent } from "../schemas/dashboard";

const UNUSUAL_WHALES_EARNINGS_BASE_URL = "https://unusualwhales.com/earnings";
const MIN_MARKET_CAP = 5_000_000_000;

export type EarningsFetchResult = {
  items: EarningsEvent[];
  mode: "live" | "unavailable";
  sourceUrl: string;
  message?: string;
};

type CandidateRecord = Record<string, unknown>;

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => ENTITY_MAP[name.toLowerCase()] ?? entity);
}

function textValue(value: unknown) {
  if (typeof value === "string") return decodeEntities(value).trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function firstText(record: CandidateRecord, keys: string[]) {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }
  return undefined;
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim().replace(/[$,]/g, "");
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i);
  if (!match) return Number.isFinite(Number(trimmed)) ? Number(trimmed) : undefined;

  const amount = Number(match[1]);
  const suffix = match[2]?.toUpperCase();
  const multipliers: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return amount * (suffix ? multipliers[suffix] : 1);
}

function marketCapValue(record: CandidateRecord) {
  return numericValue(
    record.market_cap ?? record.marketcap ?? record.marketCap ?? record.market_capitalization
  );
}

function formatCurrency(value: unknown, maximumFractionDigits = 2) {
  const number = numericValue(value);
  if (number === undefined) return textValue(value) ?? "—";
  if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(1)}B`;
  if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(0)}M`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits
  }).format(number);
}

function timingValue(value: string | undefined): EarningsEvent["time"] {
  const normalized = value?.toLowerCase() ?? "";
  if (/bmo|before|pre/.test(normalized)) return "BMO";
  if (/amc|after|post/.test(normalized)) return "AMC";
  return "TBD";
}

function eventDate(record: CandidateRecord) {
  const value = firstText(record, ["report_date", "earnings_date", "date", "start_date"]);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function pushJsonValue(values: unknown[], content: string) {
  try {
    values.push(JSON.parse(content));
  } catch {
    // Ignore non-JSON scripts embedded on the page.
  }
}

function extractJsonScripts(html: string) {
  const values: unknown[] = [];
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html))) {
    const content = decodeEntities(match[1].trim());
    if (!content) continue;

    if (content.startsWith("{") || content.startsWith("[")) {
      pushJsonValue(values, content);
    }

    const flightPattern = /self\.__next_f\.push\((\[[\s\S]*?\])\)/g;
    let flightMatch: RegExpExecArray | null;
    while ((flightMatch = flightPattern.exec(content))) {
      pushJsonValue(values, flightMatch[1]);
    }
  }

  return values;
}

function collectRecords(value: unknown, records: CandidateRecord[] = []) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        collectRecords(JSON.parse(trimmed), records);
      } catch {
        // Ignore plain text strings from framework payloads.
      }
    }
    return records;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectRecords(item, records));
    return records;
  }

  if (!value || typeof value !== "object") return records;
  const record = value as CandidateRecord;
  const ticker = firstText(record, ["ticker", "symbol", "underlying_symbol"]);
  const company = firstText(record, ["company", "company_name", "name"]);
  const cap = marketCapValue(record);

  if (ticker && company && cap !== undefined) records.push(record);
  Object.values(record).forEach((item) => collectRecords(item, records));
  return records;
}

function recordToEarnings(record: CandidateRecord): EarningsEvent | null {
  const ticker = firstText(record, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
  const company = firstText(record, ["company", "company_name", "name"]);
  const cap = marketCapValue(record);

  if (!ticker || !company || cap === undefined || cap < MIN_MARKET_CAP) return null;

  return {
    ticker,
    company,
    date: eventDate(record),
    time: timingValue(firstText(record, ["time", "report_time", "report_timing", "when"])),
    epsForecast:
      firstText(record, ["eps_estimate", "eps_forecast", "expected_eps", "estimate_eps"]) ?? "—",
    revenueForecast: formatCurrency(
      record.revenue_estimate ??
        record.revenue_forecast ??
        record.expected_revenue ??
        record.estimate_revenue
    ),
    actualEps: firstText(record, ["eps_actual", "actual_eps"]),
    actualRevenue: firstText(record, ["revenue_actual", "actual_revenue"]),
    marketCap: formatCurrency(cap, 0)
  };
}

function uniqueEarnings(items: EarningsEvent[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.ticker}-${item.date ?? ""}-${item.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function unusualWhalesEarningsUrl(minDate: string, maxDate: string) {
  const params = new URLSearchParams({
    formats: "table",
    min_date: minDate,
    max_date: maxDate,
    order: "oi",
    order_direction: "desc"
  });
  return `${UNUSUAL_WHALES_EARNINGS_BASE_URL}?${params.toString()}`;
}

export async function fetchUnusualWhalesEarnings(
  minDate: string,
  maxDate: string
): Promise<EarningsFetchResult> {
  const sourceUrl = unusualWhalesEarningsUrl(minDate, maxDate);
  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; MarketRecapBot/1.0; +https://marketrecap.local)"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) {
    return {
      items: [],
      mode: "unavailable",
      sourceUrl,
      message: "Unusual Whales earnings page was unavailable."
    };
  }

  const html = await response.text();
  const items = uniqueEarnings(
    extractJsonScripts(html)
      .flatMap((payload) => collectRecords(payload).map(recordToEarnings))
      .filter(Boolean) as EarningsEvent[]
  );

  return { items, mode: items.length ? "live" : "unavailable", sourceUrl };
}
