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
  "ES=F": "S&P 500 Futures"
};

const chartSymbols: Record<string, string> = {
  "^VIX": "%5EVIX",
  "ES=F": "ES=F"
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
        headers: { "User-Agent": "MarketRecap/1.0" }
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
  symbol: "^VIX" | "ES=F"
): Promise<YahooMarketQuote | null> {
  const chartQuote = await fetchYahooChartQuote(symbol);
  if (chartQuote) return chartQuote;
  return fetchYahooQuoteFallback(symbol);
}
