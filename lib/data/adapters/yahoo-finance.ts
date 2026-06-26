export type YahooMarketQuote = {
  source: "yahoo_finance";
  symbol: string;
  displaySymbol: string;
  name: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  marketTime: string | null;
  raw: Record<string, unknown>;
  fetchedAt: string;
};

type YahooChartResult = {
  meta?: Record<string, unknown>;
  indicators?: {
    quote?: Array<{ close?: unknown[] }>;
  };
};

type YahooQuoteResult = Record<string, unknown>;

const yahooLabels: Record<string, string> = {
  "^VIX": "VIX",
  "^VIX3M": "VIX3M",
  "ES=F": "S&P 500 Futures",
  SPY: "SPY"
};

const chartSymbols: Record<string, string> = {
  "^VIX": "%5EVIX",
  "^VIX3M": "%5EVIX3M",
  "ES=F": "ES=F",
  SPY: "SPY"
};

export function yahooNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value && typeof value === "object" && "raw" in value) {
    const raw = (value as { raw?: unknown }).raw;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }

  return null;
}

function yahooString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function yahooUnixTime(value: unknown): string | null {
  const raw = yahooNumber(value);
  if (raw === null) return null;
  const date = new Date(raw * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function lastValidCloseBeforeMostRecent(result: YahooChartResult): number | null {
  const closes = result.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) return null;
  const validCloses = closes
    .map((close) => yahooNumber(close))
    .filter((close): close is number => close !== null);
  if (!validCloses.length) return null;
  return validCloses.length > 1 ? validCloses[validCloses.length - 2] : validCloses[0];
}

function normalizeChartResult(symbol: string, result: YahooChartResult): YahooMarketQuote | null {
  const meta = result.meta;
  if (!meta) return null;

  const price = yahooNumber(meta.regularMarketPrice);
  const previousClose =
    yahooNumber(meta.previousClose) ??
    yahooNumber(meta.chartPreviousClose) ??
    lastValidCloseBeforeMostRecent(result);
  const change = price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent =
    change !== null && previousClose !== null && previousClose > 0
      ? (change / previousClose) * 100
      : null;

  if (price === null && previousClose === null) return null;

  return {
    source: "yahoo_finance",
    symbol,
    displaySymbol: yahooLabels[symbol] ?? symbol,
    name: yahooString(meta.longName) ?? yahooString(meta.shortName) ?? yahooLabels[symbol] ?? null,
    price,
    previousClose,
    change,
    changePercent,
    marketTime: yahooUnixTime(meta.regularMarketTime),
    raw: result as Record<string, unknown>,
    fetchedAt: new Date().toISOString()
  };
}

function normalizeQuoteResult(symbol: string, result: YahooQuoteResult): YahooMarketQuote | null {
  const price = yahooNumber(result.regularMarketPrice);
  const change = yahooNumber(result.regularMarketChange);
  const changePercent = yahooNumber(result.regularMarketChangePercent);
  const previousClose = price !== null && change !== null ? price - change : null;

  if (price === null && change === null) return null;

  return {
    source: "yahoo_finance",
    symbol,
    displaySymbol: yahooLabels[symbol] ?? symbol,
    name:
      yahooString(result.longName) ?? yahooString(result.shortName) ?? yahooLabels[symbol] ?? null,
    price,
    previousClose,
    change,
    changePercent,
    marketTime: yahooUnixTime(result.regularMarketTime),
    raw: result,
    fetchedAt: new Date().toISOString()
  };
}

function shouldRetry(status: number) {
  return status === 429 || status >= 500;
}

async function fetchJson(url: string, timeoutMs = 12_000, attempts = 2): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "User-Agent": "AlphaDigest/1.0" }
      });

      if (!response.ok) {
        if (shouldRetry(response.status) && attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
        return null;
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError) return null;
  return null;
}

function firstValidClose(result: YahooChartResult): number | null {
  const closes = result.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) return null;
  for (const close of closes) {
    const value = yahooNumber(close);
    if (value !== null && value > 0) return value;
  }
  return null;
}

export async function fetchYahooYtdReturn(symbol: "SPY") {
  const now = new Date();
  const period1 = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const encodedSymbol = chartSymbols[symbol] ?? encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?period1=${period1}&period2=${period2}&interval=1d&lang=en-US&region=US`;
  const json = await fetchJson(url);
  if (!json || typeof json !== "object") return null;
  const result = (json as { chart?: { result?: YahooChartResult[] } }).chart?.result?.[0];
  if (!result) return null;
  const start = firstValidClose(result);
  const current =
    yahooNumber(result.meta?.regularMarketPrice) ?? lastValidCloseBeforeMostRecent(result);
  if (start === null || current === null || start <= 0) return null;
  return {
    symbol,
    currentPrice: current,
    startPrice: start,
    ytdReturn: ((current - start) / start) * 100
  };
}

async function fetchYahooChartQuote(symbol: string): Promise<YahooMarketQuote | null> {
  const encodedSymbol = chartSymbols[symbol] ?? encodeURIComponent(symbol);
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 5 * 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?period1=${period1}&period2=${period2}&lang=en-US&region=US`;
  const json = await fetchJson(url);
  if (!json || typeof json !== "object") return null;
  const result = (json as { chart?: { result?: YahooChartResult[] } }).chart?.result?.[0];
  return result ? normalizeChartResult(symbol, result) : null;
}

async function fetchYahooQuoteFallback(symbol: string): Promise<YahooMarketQuote | null> {
  const encodedSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?fields=longName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName,priceHint,regularMarketTime,regularMarketVolume&formatted=true&symbols=${encodedSymbol}&lang=en-US&region=US`;
  const json = await fetchJson(url);
  if (!json || typeof json !== "object") return null;
  const result = (json as { quoteResponse?: { result?: YahooQuoteResult[] } }).quoteResponse
    ?.result?.[0];
  return result ? normalizeQuoteResult(symbol, result) : null;
}

export async function fetchYahooMarketQuote(
  symbol: "^VIX" | "^VIX3M" | "ES=F" | "SPY"
): Promise<YahooMarketQuote | null> {
  const chartQuote = await fetchYahooChartQuote(symbol);
  if (chartQuote) return chartQuote;
  return fetchYahooQuoteFallback(symbol);
}

import { createServerSupabaseClient } from "@/lib/db/supabase";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";
import { stableHash } from "./unusual-whales-earnings";

const MARKET_QUOTES_METADATA_SOURCE = "yahoo_market_quotes";
const MARKET_QUOTE_SYMBOLS: Array<"^VIX" | "^VIX3M" | "ES=F" | "SPY"> = [
  "^VIX",
  "^VIX3M",
  "ES=F",
  "SPY"
];

type CachedMarketQuotesResult = {
  quotes: YahooMarketQuote[];
  mode: "live" | "unavailable";
  message?: string;
};

function quoteContentHash(quote: YahooMarketQuote) {
  return stableHash({
    symbol: quote.symbol,
    displaySymbol: quote.displaySymbol,
    name: quote.name,
    price: quote.price,
    previousClose: quote.previousClose,
    change: quote.change,
    changePercent: quote.changePercent,
    marketTime: quote.marketTime
  });
}

function quoteToDbRow(quote: YahooMarketQuote) {
  return {
    id: `yahoo_finance:${quote.symbol}`,
    source: quote.source,
    symbol: quote.symbol,
    display_symbol: quote.displaySymbol,
    name: quote.name,
    price: quote.price,
    previous_close: quote.previousClose,
    change: quote.change,
    change_percent: quote.changePercent,
    market_time: quote.marketTime,
    raw: quote.raw,
    content_hash: quoteContentHash(quote),
    fetched_at: quote.fetchedAt,
    updated_at: new Date().toISOString()
  };
}

function quoteFromDbRow(row: Record<string, unknown>): YahooMarketQuote {
  return {
    source: "yahoo_finance",
    symbol: String(row.symbol),
    displaySymbol:
      yahooString(row.display_symbol) ?? yahooLabels[String(row.symbol)] ?? String(row.symbol),
    name: yahooString(row.name),
    price: yahooNumber(row.price),
    previousClose: yahooNumber(row.previous_close),
    change: yahooNumber(row.change),
    changePercent: yahooNumber(row.change_percent),
    marketTime: yahooString(row.market_time),
    raw:
      row.raw && typeof row.raw === "object" && !Array.isArray(row.raw)
        ? (row.raw as Record<string, unknown>)
        : {},
    fetchedAt: yahooString(row.fetched_at) ?? new Date().toISOString()
  };
}

export async function refreshYahooMarketQuotes(symbols = MARKET_QUOTE_SYMBOLS) {
  console.log("force_refresh_fetch", { source: MARKET_QUOTES_METADATA_SOURCE, symbols });
  const supabase = createServerSupabaseClient();
  const quotes = (await Promise.all(symbols.map((symbol) => fetchYahooMarketQuote(symbol)))).filter(
    (quote): quote is YahooMarketQuote => Boolean(quote)
  );
  const rows = quotes.map(quoteToDbRow);
  const contentHash = payloadContentHash(
    rows.map(({ fetched_at: _fetchedAt, updated_at: _updatedAt, ...row }) => row)
  );
  console.log("force_refresh_normalized", {
    source: MARKET_QUOTES_METADATA_SOURCE,
    fetched: quotes.length,
    normalized: rows.length
  });

  if (!supabase.ok)
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: true,
      contentHash,
      persisted: false,
      error: supabase.message
    });

  try {
    const { data: metadata } = await supabase.client
      .from("data_refresh_metadata")
      .select("content_hash")
      .eq("source", MARKET_QUOTES_METADATA_SOURCE)
      .maybeSingle();
    const changed = metadata?.content_hash !== contentHash;
    let upserted = 0;
    if (rows.length) {
      const { error } = await supabase.client
        .from("market_quotes")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase market quotes upsert failed: ${error.message}`);
      upserted = rows.length;
    }
    await updateRefreshMetadata(supabase.client, MARKET_QUOTES_METADATA_SOURCE, {
      ok: true,
      changed,
      rowCount: rows.length,
      contentHash,
      meta: { symbols }
    });
    console.log("force_refresh_upserted", {
      source: MARKET_QUOTES_METADATA_SOURCE,
      upserted,
      changed
    });
    return sourceResult({
      ok: true,
      count: rows.length,
      changed,
      contentHash,
      upserted,
      persisted: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown market quotes refresh error";
    await updateRefreshMetadata(supabase.client, MARKET_QUOTES_METADATA_SOURCE, {
      ok: false,
      changed: null,
      rowCount: rows.length,
      contentHash,
      error: message,
      meta: { symbols }
    });
    console.error("force_refresh_error", { source: MARKET_QUOTES_METADATA_SOURCE, error: message });
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: null,
      contentHash,
      error: message,
      persisted: false
    });
  }
}

export async function getCachedYahooMarketQuotes(
  symbols = MARKET_QUOTE_SYMBOLS
): Promise<CachedMarketQuotesResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { quotes: [], mode: "unavailable", message: supabase.message };
  const { data, error } = await supabase.client
    .from("market_quotes")
    .select("*")
    .in("symbol", symbols)
    .order("symbol", { ascending: true });
  if (error || !data?.length) {
    return {
      quotes: [],
      mode: "unavailable",
      message: error
        ? `Supabase market quotes read failed: ${error.message}`
        : "Supabase market quotes cache is empty."
    };
  }
  return {
    quotes: data.map((row) => quoteFromDbRow(row as Record<string, unknown>)),
    mode: "live"
  };
}

export async function getCachedYahooMarketQuote(symbol: "^VIX" | "^VIX3M" | "ES=F" | "SPY") {
  const result = await getCachedYahooMarketQuotes([symbol]);
  return result.quotes.find((quote) => quote.symbol === symbol) ?? null;
}
