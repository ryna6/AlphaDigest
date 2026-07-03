import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import type { Metric } from "../schemas/common";
import { stableHash } from "./unusual-whales-earnings";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";

const INVESTING_TABLE = "%_above_ma";
const YAHOO_TABLE = "52w_high_low";
const SOURCE = "market_breadth";
const FETCH_TIMEOUT_MS = 15_000;

export type BreadthOhlc = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

export const INVESTING_BREADTH_SOURCES = {
  above50d: {
    metric: "% Above 50D MA",
    id: "1225324",
    url: "https://api.investing.com/api/financialdata/1225324/historical/chart/?interval=P1D&pointscount=160"
  },
  above200d: {
    metric: "% Above 200D MA",
    id: "1225364",
    url: "https://api.investing.com/api/financialdata/1225364/historical/chart/?interval=P1D&pointscount=160"
  }
} as const;

export const YAHOO_52_WEEK_SOURCES = {
  highs: {
    metric: "52W Highs",
    scrId: "recent_52_week_highs",
    url: "https://query1.finance.yahoo.com/v1/finance/screener?formatted=true&useRecordsResponse=true&lang=en-CA&region=CA"
  },
  lows: {
    metric: "52W Lows",
    scrId: "recent_52_week_lows",
    url: "https://query1.finance.yahoo.com/v1/finance/screener?formatted=true&useRecordsResponse=true&lang=en-CA&region=CA"
  }
} as const;

export const MARKET_BREADTH_SOURCE_URL = [
  ...Object.values(INVESTING_BREADTH_SOURCES),
  ...Object.values(YAHOO_52_WEEK_SOURCES)
]
  .map((source) => source.url)
  .join(",");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const JSON_HEADERS = {
  "user-agent": USER_AGENT,
  accept: "application/json",
  "accept-language": "en-CA,en-US;q=0.9,en;q=0.8",
  "cache-control": "no-cache"
} as const;

export type ParsedMarketBreadth = {
  above50d: BreadthOhlc;
  above200d: BreadthOhlc;
  highs52w: number;
  lows52w: number;
  sourceUpdatedAt: string | null;
  movingAverageSource: string;
  highLowSource: string;
};

export type InvestingBreadthSnapshot = {
  id: string;
  above50d: BreadthOhlc;
  above200d: BreadthOhlc;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
};

export type YahooBreadthSnapshot = {
  id: string;
  highs52w: number;
  lows52w: number;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
};

export type MarketBreadthSnapshot = ParsedMarketBreadth & {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
};

export type ProviderStatus = "success" | "failed";

export type ProviderDiagnostics = {
  url: string;
  status?: number;
  contentType?: string;
  finalUrl?: string;
  responseLength?: number;
  appearsBlocked?: boolean;
  method: string;
  provider?: string;
  screenerId?: string;
  crumbRefreshed?: boolean;
};

function finiteNumber(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? n : null;
}

function rowsFromInvestingPayload(payload: unknown): unknown[] {
  if (!isRec(payload) || !Array.isArray(payload.data)) {
    throw new Error("Investing.com breadth response is missing payload.data row array.");
  }
  return payload.data as unknown[];
}

function validateOhlc(row: BreadthOhlc) {
  if (!Number.isFinite(row.timestamp) || row.timestamp <= 0)
    throw new Error("Investing.com timestamp is not finite and positive.");
  for (const key of ["open", "high", "low", "close"] as const) {
    const value = row[key];
    if (!Number.isFinite(value)) throw new Error(`Investing.com ${key} is not finite.`);
    if (value < 0 || value > 100) throw new Error(`Investing.com ${key} is outside 0-100.`);
  }
}

export function parseLatestInvestingBreadthRow(payload: unknown): BreadthOhlc {
  const validRows = rowsFromInvestingPayload(payload).filter(
    (row): row is number[] =>
      Array.isArray(row) &&
      row.length >= 5 &&
      row.slice(0, 5).every((value) => typeof value === "number" && Number.isFinite(value))
  );

  if (!validRows.length)
    throw new Error("Investing.com breadth response contained no valid OHLC rows.");

  const latest = validRows.reduce((currentLatest, row) =>
    row[0] > currentLatest[0] ? row : currentLatest
  );

  const parsed = {
    timestamp: latest[0],
    open: latest[1],
    high: latest[2],
    low: latest[3],
    close: latest[4]
  };
  validateOhlc(parsed);
  return parsed;
}

export function parseYahooScreenerTotal(payload: unknown): number {
  if (!isRec(payload) || !isRec(payload.finance))
    throw new Error("Yahoo Finance screener response is missing finance.result.");
  if (!("error" in payload.finance) || payload.finance.error !== null)
    throw new Error(
      `Yahoo Finance screener returned an error or omitted finance.error: ${JSON.stringify(payload.finance.error)}`
    );
  if (!Array.isArray(payload.finance.result))
    throw new Error("Yahoo Finance screener response is missing finance.result.");
  if (payload.finance.result.length === 0)
    throw new Error("Yahoo Finance screener response has an empty result array.");
  const first = payload.finance.result[0];
  if (!isRec(first) || !("total" in first))
    throw new Error("Yahoo Finance screener result is missing total.");
  const total = first.total;
  if (typeof total !== "number" || !Number.isFinite(total) || !Number.isInteger(total) || total < 0)
    throw new Error("Yahoo Finance screener total must be a finite non-negative integer.");
  return total;
}

export function yahooScreenerRequest(scrId: string, crumb?: string) {
  const url = crumb
    ? `${YAHOO_52_WEEK_SOURCES.highs.url}&crumb=${encodeURIComponent(crumb)}`
    : YAHOO_52_WEEK_SOURCES.highs.url;
  return { url, body: { scrIds: scrId, count: 100, start: 0 } };
}

function looksLikeBlock(text: string) {
  return /captcha|cloudflare|access denied|verify you are human|unusual traffic|enable javascript and cookies/i.test(
    text
  );
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, provider: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });
    const text = await response.text();
    const diagnostic: ProviderDiagnostics = {
      url,
      status: response.status,
      contentType: response.headers.get("content-type") ?? undefined,
      finalUrl: response.url,
      responseLength: text.length,
      appearsBlocked: looksLikeBlock(text),
      method: init.method ?? "GET",
      provider
    };
    if (!response.ok || diagnostic.appearsBlocked)
      throw new Error(`${provider} fetch failed: ${JSON.stringify(diagnostic)}`);
    if (/html/i.test(diagnostic.contentType ?? "") || /^\s*</.test(text))
      throw new Error(`${provider} returned HTML instead of JSON: ${JSON.stringify(diagnostic)}`);
    try {
      return { json: JSON.parse(text), diagnostic };
    } catch {
      throw new Error(`${provider} returned malformed JSON: ${JSON.stringify(diagnostic)}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(`${provider} fetch timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchInvestingBreadthOhlc(
  source: (typeof INVESTING_BREADTH_SOURCES)[keyof typeof INVESTING_BREADTH_SOURCES]
) {
  const { json, diagnostic } = await fetchJsonWithTimeout(
    source.url,
    { headers: { ...JSON_HEADERS, referer: "https://www.investing.com/" } },
    "Investing.com"
  );
  console.info("refresh-market-breadth", {
    stage:
      source.id === INVESTING_BREADTH_SOURCES.above50d.id
        ? "investing_50d_fetched"
        : "investing_200d_fetched",
    status: diagnostic.status,
    responseLength: diagnostic.responseLength
  });
  const row = parseLatestInvestingBreadthRow(json);
  return { row, diagnostic };
}

async function fetchYahooCrumb() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      cache: "no-store",
      headers: JSON_HEADERS,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok || looksLikeBlock(text) || /^\s*</.test(text)) return undefined;
    const crumb = text.trim();
    return crumb && !/\s/.test(crumb) ? crumb : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchYahooScreenerTotal(scrId: string) {
  let crumb: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { url, body } = yahooScreenerRequest(scrId, crumb);
    try {
      const { json, diagnostic } = await fetchJsonWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            ...JSON_HEADERS,
            "content-type": "application/json",
            origin: "https://finance.yahoo.com",
            referer: "https://finance.yahoo.com/research-hub/screener/"
          },
          body: JSON.stringify(body)
        },
        "Yahoo Finance screener"
      );
      console.info("refresh-market-breadth", {
        stage:
          scrId === YAHOO_52_WEEK_SOURCES.highs.scrId
            ? "yahoo_highs_fetched"
            : "yahoo_lows_fetched",
        status: diagnostic.status,
        responseLength: diagnostic.responseLength,
        screenerId: scrId,
        crumbRefreshed: Boolean(crumb)
      });
      const total = parseYahooScreenerTotal(json);
      return {
        total,
        diagnostic: { ...diagnostic, screenerId: scrId, crumbRefreshed: Boolean(crumb) }
      };
    } catch (error) {
      if (attempt === 0) {
        crumb = await fetchYahooCrumb();
        if (crumb) continue;
      }
      throw error;
    }
  }
  throw new Error("Yahoo Finance screener fetch failed.");
}

export function validateMarketBreadth(snapshot: ParsedMarketBreadth) {
  validateOhlc(snapshot.above50d);
  validateOhlc(snapshot.above200d);
  if (!Number.isInteger(snapshot.highs52w) || snapshot.highs52w < 0)
    throw new Error("Market breadth 52-week highs count is invalid.");
  if (!Number.isInteger(snapshot.lows52w) || snapshot.lows52w < 0)
    throw new Error("Market breadth 52-week lows count is invalid.");
}

export function createMarketBreadthSnapshot(
  values: ParsedMarketBreadth,
  fetchedAt = new Date().toISOString()
): MarketBreadthSnapshot {
  validateMarketBreadth(values);
  const sourceUrl = MARKET_BREADTH_SOURCE_URL;
  return {
    id: "sp500",
    ...values,
    sourceUrl,
    fetchedAt,
    contentHash: stableHash({ ...values, sourceUrl })
  };
}

export async function buildInvestingBreadthSnapshot(
  fetchedAt = new Date().toISOString()
): Promise<InvestingBreadthSnapshot> {
  let stage = "investing_50d_fetch";
  try {
    const above50dResult = await fetchInvestingBreadthOhlc(INVESTING_BREADTH_SOURCES.above50d);
    console.info("refresh-market-breadth", {
      stage: "investing_50d_parsed",
      timestamp: above50dResult.row.timestamp
    });

    stage = "investing_200d_fetch";
    const above200dResult = await fetchInvestingBreadthOhlc(INVESTING_BREADTH_SOURCES.above200d);
    console.info("refresh-market-breadth", {
      stage: "investing_200d_parsed",
      timestamp: above200dResult.row.timestamp
    });

    const values = { above50d: above50dResult.row, above200d: above200dResult.row };
    validateOhlc(values.above50d);
    validateOhlc(values.above200d);
    return {
      id: "sp500",
      ...values,
      sourceUrl:
        INVESTING_BREADTH_SOURCES.above50d.url + "," + INVESTING_BREADTH_SOURCES.above200d.url,
      fetchedAt,
      contentHash: stableHash(values)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Investing.com breadth error";
    throw new Error(`Investing.com Market Breadth failed at ${stage}: ${message}`);
  }
}

export async function buildYahooBreadthSnapshot(
  fetchedAt = new Date().toISOString()
): Promise<YahooBreadthSnapshot> {
  let stage = "yahoo_highs_fetch";
  try {
    const highs52wResult = await fetchYahooScreenerTotal(YAHOO_52_WEEK_SOURCES.highs.scrId);
    console.info("refresh-market-breadth", {
      stage: "yahoo_highs_parsed",
      screenerId: YAHOO_52_WEEK_SOURCES.highs.scrId,
      total: highs52wResult.total
    });

    stage = "yahoo_lows_fetch";
    const lows52wResult = await fetchYahooScreenerTotal(YAHOO_52_WEEK_SOURCES.lows.scrId);
    console.info("refresh-market-breadth", {
      stage: "yahoo_lows_parsed",
      screenerId: YAHOO_52_WEEK_SOURCES.lows.scrId,
      total: lows52wResult.total
    });

    if (!Number.isInteger(highs52wResult.total) || highs52wResult.total < 0)
      throw new Error("Yahoo highs total is invalid.");
    if (!Number.isInteger(lows52wResult.total) || lows52wResult.total < 0)
      throw new Error("Yahoo lows total is invalid.");
    const values = { highs52w: highs52wResult.total, lows52w: lows52wResult.total };
    return {
      id: "sp500",
      ...values,
      sourceUrl: YAHOO_52_WEEK_SOURCES.highs.url + "," + YAHOO_52_WEEK_SOURCES.lows.url,
      fetchedAt,
      contentHash: stableHash(values)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Yahoo breadth error";
    throw new Error(`Yahoo Market Breadth failed at ${stage}: ${message}`);
  }
}

export async function buildMarketBreadthSnapshot() {
  const fetchedAt = new Date().toISOString();
  const investing = await buildInvestingBreadthSnapshot(fetchedAt);
  const yahoo = await buildYahooBreadthSnapshot(fetchedAt);
  return createMarketBreadthSnapshot(
    {
      above50d: investing.above50d,
      above200d: investing.above200d,
      highs52w: yahoo.highs52w,
      lows52w: yahoo.lows52w,
      sourceUpdatedAt: null,
      movingAverageSource: "Investing.com financialdata latest close",
      highLowSource:
        "Yahoo Finance predefined screeners (reported total; universe not verified as S&P 500-only)"
    },
    fetchedAt
  );
}

function investingToDb(snapshot: InvestingBreadthSnapshot) {
  validateOhlc(snapshot.above50d);
  validateOhlc(snapshot.above200d);
  return {
    id: snapshot.id,
    above_50d_timestamp: snapshot.above50d.timestamp,
    above_50d_open: snapshot.above50d.open,
    above_50d_high: snapshot.above50d.high,
    above_50d_low: snapshot.above50d.low,
    above_50d_close: snapshot.above50d.close,
    above_200d_timestamp: snapshot.above200d.timestamp,
    above_200d_open: snapshot.above200d.open,
    above_200d_high: snapshot.above200d.high,
    above_200d_low: snapshot.above200d.low,
    above_200d_close: snapshot.above200d.close,
    source_url: snapshot.sourceUrl,
    fetched_at: snapshot.fetchedAt,
    content_hash: snapshot.contentHash,
    updated_at: new Date().toISOString()
  };
}

function yahooToDb(snapshot: YahooBreadthSnapshot) {
  if (!Number.isInteger(snapshot.highs52w) || snapshot.highs52w < 0)
    throw new Error("Yahoo highs total is invalid.");
  if (!Number.isInteger(snapshot.lows52w) || snapshot.lows52w < 0)
    throw new Error("Yahoo lows total is invalid.");
  return {
    id: snapshot.id,
    highs_52w: snapshot.highs52w,
    lows_52w: snapshot.lows52w,
    source_url: snapshot.sourceUrl,
    fetched_at: snapshot.fetchedAt,
    content_hash: snapshot.contentHash,
    updated_at: new Date().toISOString()
  };
}

export async function writeInvestingBreadthSnapshot(
  client: SupabaseClient,
  snapshot: InvestingBreadthSnapshot
) {
  console.info("refresh-market-breadth", {
    stage: "investing_write_started",
    table: INVESTING_TABLE,
    mode: "upsert",
    onConflict: "id"
  });
  const { data, error } = await client
    .from(INVESTING_TABLE)
    .upsert(investingToDb(snapshot), { onConflict: "id" })
    .select("id,fetched_at,above_50d_close,above_200d_close")
    .single();
  if (error)
    throw new Error(
      `%_above_ma upsert failed: ${(error as { code?: string }).code ?? "unknown"} ${error.message ?? JSON.stringify(error)}`
    );
  if (!data) throw new Error("Supabase %_above_ma upsert returned no row.");
  console.info("refresh-market-breadth", {
    stage: "investing_write_succeeded",
    table: INVESTING_TABLE,
    id: (data as Rec).id,
    fetchedAt: (data as Rec).fetched_at
  });
}

export async function writeYahooBreadthSnapshot(
  client: SupabaseClient,
  snapshot: YahooBreadthSnapshot
) {
  console.info("refresh-market-breadth", {
    stage: "yahoo_write_started",
    table: YAHOO_TABLE,
    mode: "upsert",
    onConflict: "id"
  });
  const { data, error } = await client
    .from(YAHOO_TABLE)
    .upsert(yahooToDb(snapshot), { onConflict: "id" })
    .select("id,fetched_at,highs_52w,lows_52w")
    .single();
  if (error)
    throw new Error(
      `52w_high_low upsert failed: ${(error as { code?: string }).code ?? "unknown"} ${error.message ?? JSON.stringify(error)}`
    );
  if (!data) throw new Error("Supabase 52w_high_low upsert returned no row.");
  console.info("refresh-market-breadth", {
    stage: "yahoo_write_succeeded",
    table: YAHOO_TABLE,
    id: (data as Rec).id,
    fetchedAt: (data as Rec).fetched_at
  });
}

export async function writeMarketBreadthSnapshot(
  client: SupabaseClient,
  snapshot: MarketBreadthSnapshot
) {
  await writeInvestingBreadthSnapshot(client, {
    id: snapshot.id,
    above50d: snapshot.above50d,
    above200d: snapshot.above200d,
    sourceUrl: snapshot.sourceUrl,
    fetchedAt: snapshot.fetchedAt,
    contentHash: snapshot.contentHash
  });
  await writeYahooBreadthSnapshot(client, {
    id: snapshot.id,
    highs52w: snapshot.highs52w,
    lows52w: snapshot.lows52w,
    sourceUrl: snapshot.sourceUrl,
    fetchedAt: snapshot.fetchedAt,
    contentHash: snapshot.contentHash
  });
}

export async function refreshMarketBreadth() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return sourceResult({ ok: false, count: 0, error: supabase.message, persisted: false });
  const fetchedAt = new Date().toISOString();
  const providerStatuses: Record<"investing" | "yahoo", ProviderStatus> = {
    investing: "failed",
    yahoo: "failed"
  };
  const errors: Record<string, string> = {};
  let upserted = 0;
  let investingSnapshot: InvestingBreadthSnapshot | null = null;
  let yahooSnapshot: YahooBreadthSnapshot | null = null;

  try {
    investingSnapshot = await buildInvestingBreadthSnapshot(fetchedAt);
    await writeInvestingBreadthSnapshot(supabase.client, investingSnapshot);
    providerStatuses.investing = "success";
    upserted += 1;
  } catch (error) {
    errors.investing =
      error instanceof Error ? error.message : "Unknown Investing.com Market Breadth error";
  }

  try {
    yahooSnapshot = await buildYahooBreadthSnapshot(fetchedAt);
    await writeYahooBreadthSnapshot(supabase.client, yahooSnapshot);
    providerStatuses.yahoo = "success";
    upserted += 1;
  } catch (error) {
    errors.yahoo = error instanceof Error ? error.message : "Unknown Yahoo Market Breadth error";
  }

  const ok = providerStatuses.investing === "success" && providerStatuses.yahoo === "success";
  const meta = {
    method: "investing-financialdata-latest-timestamp-ohlc + yahoo-screener-total",
    tables: { investing: INVESTING_TABLE, yahoo: YAHOO_TABLE },
    providerStatuses,
    errors,
    preservedCache: !ok,
    fetchedAt
  };
  try {
    await updateRefreshMetadata(supabase.client, SOURCE, {
      ok,
      changed: upserted > 0,
      rowCount: upserted,
      contentHash: payloadContentHash([investingSnapshot, yahooSnapshot].filter(Boolean)),
      error: ok ? undefined : Object.values(errors).join("; "),
      meta
    });
  } catch {}
  return sourceResult({
    ok,
    count: upserted,
    changed: upserted > 0,
    contentHash:
      ok && investingSnapshot && yahooSnapshot
        ? stableHash({ investingSnapshot, yahooSnapshot })
        : undefined,
    upserted,
    persisted: upserted > 0,
    error: ok ? undefined : Object.values(errors).join("; "),
    meta
  });
}

function fromSplitDb(investingRow: Rec | null, yahooRow: Rec | null): MarketBreadthSnapshot | null {
  if (!investingRow || !yahooRow) return null;
  const parsed = {
    above50d: {
      timestamp: Number(investingRow.above_50d_timestamp ?? 0),
      open: Number(investingRow.above_50d_open),
      high: Number(investingRow.above_50d_high),
      low: Number(investingRow.above_50d_low),
      close: Number(investingRow.above_50d_close)
    },
    above200d: {
      timestamp: Number(investingRow.above_200d_timestamp ?? 0),
      open: Number(investingRow.above_200d_open),
      high: Number(investingRow.above_200d_high),
      low: Number(investingRow.above_200d_low),
      close: Number(investingRow.above_200d_close)
    },
    highs52w: Number(yahooRow.highs_52w),
    lows52w: Number(yahooRow.lows_52w),
    sourceUpdatedAt: null,
    movingAverageSource: "Investing.com financialdata latest close",
    highLowSource:
      "Yahoo Finance predefined screeners (reported total; universe not verified as S&P 500-only)"
  };
  try {
    validateMarketBreadth(parsed);
  } catch {
    return null;
  }
  const fetchedAt = String(
    investingRow.fetched_at ?? yahooRow.fetched_at ?? new Date().toISOString()
  );
  return {
    id: "sp500",
    ...parsed,
    sourceUrl: MARKET_BREADTH_SOURCE_URL,
    fetchedAt,
    contentHash: stableHash(parsed)
  };
}

export async function readCachedSp500Breadth(client?: SupabaseClient) {
  const supabase = client ? { ok: true as const, client } : createServerSupabaseClient();
  if (!supabase.ok) return { snapshot: null, message: supabase.message };
  const investingSelect =
    "above_50d_timestamp,above_50d_open,above_50d_high,above_50d_low,above_50d_close,above_200d_timestamp,above_200d_open,above_200d_high,above_200d_low,above_200d_close,fetched_at";
  const yahooSelect = "highs_52w,lows_52w,fetched_at";
  const [investing, yahoo] = await Promise.all([
    supabase.client
      .from(INVESTING_TABLE)
      .select(investingSelect)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.client
      .from(YAHOO_TABLE)
      .select(yahooSelect)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (investing.error || yahoo.error)
    return { snapshot: null, message: investing.error?.message ?? yahoo.error?.message };
  return {
    snapshot: fromSplitDb(
      isRec(investing.data) ? investing.data : null,
      isRec(yahoo.data) ? yahoo.data : null
    )
  };
}

export function marketBreadthMetrics(snapshot: MarketBreadthSnapshot | null): Metric[] {
  const unavailable = {
    value: "—",
    subtext: "Market breadth cache unavailable",
    tone: "neutral" as const
  };
  return [
    {
      label: "% Above 50D MA",
      ...(snapshot
        ? {
            value: `${snapshot.above50d.close.toFixed(1)}%`,
            subtext: snapshot.movingAverageSource,
            tone: "neutral" as const
          }
        : unavailable)
    },
    {
      label: "% Above 200D MA",
      ...(snapshot
        ? {
            value: `${snapshot.above200d.close.toFixed(1)}%`,
            subtext: snapshot.movingAverageSource,
            tone: "neutral" as const
          }
        : unavailable)
    },
    {
      label: "52W Highs and Lows",
      ...(snapshot
        ? {
            value: `${snapshot.highs52w.toLocaleString()} / ${snapshot.lows52w.toLocaleString()}`,
            subtext: snapshot.highLowSource,
            tone:
              snapshot.highs52w >= snapshot.lows52w ? ("positive" as const) : ("negative" as const)
          }
        : unavailable)
    }
  ];
}
