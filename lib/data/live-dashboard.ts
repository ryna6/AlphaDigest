import type { FinnhubFeatureArea } from "./adapters/finnhub-key-router";
import { getFinnhubKey } from "./adapters/finnhub-key-router";
import { marketsMock, todayMock } from "./fixtures/mock-dashboard";
import type { HeatmapTile, Metric } from "./schemas/common";
import type { MarketsPayload, TodayPayload } from "./schemas/dashboard";

const quoteSymbols: Record<FinnhubFeatureArea, Array<{ symbol: string; label: string; weight: number }>> = {
  "global-markets": [
    { symbol: "SPY", label: "US market", weight: 18 },
    { symbol: "EWC", label: "Canadian market", weight: 10 },
    { symbol: "IEUR", label: "EU market", weight: 12 },
    { symbol: "EWJ", label: "Japan market", weight: 10 },
    { symbol: "EWT", label: "Taiwan market", weight: 9 },
    { symbol: "EWH", label: "Hong Kong market", weight: 9 },
    { symbol: "EWY", label: "Korean market", weight: 9 },
    { symbol: "INDA", label: "Indian market", weight: 10 }
  ],
  "sectors-heatmap": [
    { symbol: "XLK", label: "Tech", weight: 18 },
    { symbol: "XLF", label: "Financials", weight: 13 },
    { symbol: "XLC", label: "Communication Services", weight: 11 },
    { symbol: "XLY", label: "Consumer Discretionary", weight: 11 },
    { symbol: "XLI", label: "Industrials", weight: 10 },
    { symbol: "XLV", label: "Healthcare", weight: 12 },
    { symbol: "XLP", label: "Consumer Staples", weight: 8 },
    { symbol: "XLU", label: "Utilities", weight: 8 },
    { symbol: "XLB", label: "Materials", weight: 7 },
    { symbol: "XLE", label: "Energy", weight: 10 },
    { symbol: "XLRE", label: "Real Estate", weight: 7 }
  ],
  "crypto-heatmap": [
    { symbol: "BTC", label: "Bitcoin", weight: 28 },
    { symbol: "ETH", label: "Ethereum", weight: 22 },
    { symbol: "SOL", label: "Solana", weight: 12 },
    { symbol: "XRP", label: "XRP", weight: 8 },
    { symbol: "BNB", label: "BNB", weight: 8 },
    { symbol: "TRX", label: "TRON", weight: 7 },
    { symbol: "ADA", label: "Cardano", weight: 7 },
    { symbol: "DOGE", label: "Dogecoin", weight: 6 }
  ],
  "macro-heatmap": [
    { symbol: "GLD", label: "Gold", weight: 12 },
    { symbol: "SLV", label: "Silver", weight: 8 },
    { symbol: "USO", label: "Crude oil", weight: 10 },
    { symbol: "UNG", label: "Natgas", weight: 8 },
    { symbol: "SHY", label: "Short-term bond", weight: 10 },
    { symbol: "TLT", label: "Long-term bond", weight: 12 },
    { symbol: "HYG", label: "High-risk corp bond", weight: 10 },
    { symbol: "DXY", label: "U.S. Dollar Index", weight: 10 }
  ]
};

type FinnhubQuote = { c?: number; d?: number; dp?: number; pc?: number };

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

function formatChange(value: number) {
  return `${value >= 0 ? "+" : ""}${formatNumber(value, { maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toneFromChange(value: number): Metric["tone"] {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

async function fetchFinnhubQuote(featureArea: FinnhubFeatureArea, symbol: string): Promise<FinnhubQuote | null> {
  const route = getFinnhubKey(featureArea);
  if (!route.ok) return null;

  const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${route.key}`, {
    cache: "no-store"
  });

  if (!response.ok) return null;
  const quote = (await response.json()) as FinnhubQuote;
  if (!quote.c || quote.c <= 0) return null;
  return quote;
}

async function quoteMetric(featureArea: FinnhubFeatureArea, symbol: string, label: string): Promise<Metric | null> {
  const quote = await fetchFinnhubQuote(featureArea, symbol);
  if (!quote?.c) return null;
  const change = quote.d ?? (quote.pc ? quote.c - quote.pc : 0);
  const changePercent = quote.dp ?? (quote.pc ? (change / quote.pc) * 100 : 0);
  return {
    label,
    value: formatNumber(quote.c, { maximumFractionDigits: 2 }),
    change: formatChange(change),
    changePercent: formatPercent(changePercent),
    tone: toneFromChange(changePercent)
  };
}

async function heatmap(featureArea: FinnhubFeatureArea): Promise<HeatmapTile[] | null> {
  const rows = await Promise.all(quoteSymbols[featureArea].map(async (item) => {
    const quote = await fetchFinnhubQuote(featureArea, item.symbol);
    if (!quote?.c) return null;
    const changePercent = quote.dp ?? 0;
    return { symbol: item.symbol, label: item.label, value: quote.c, changePercent, weight: item.weight };
  }));

  const valid = rows.filter((row): row is HeatmapTile => Boolean(row));
  return valid.length ? valid : null;
}

export async function getMarketsPayload(): Promise<{ payload: MarketsPayload; mode: "mock" | "live"; notices: string[] }> {
  const fallback = marketsMock();
  const [globalMarkets, sectors, crypto, macro] = await Promise.all([
    heatmap("global-markets"),
    heatmap("sectors-heatmap"),
    heatmap("crypto-heatmap"),
    heatmap("macro-heatmap")
  ]);

  const liveHeatmaps = { globalMarkets, sectors, crypto, macro };
  const hasLive = Object.values(liveHeatmaps).some(Boolean);
  if (!hasLive) return { payload: fallback, mode: "mock", notices: ["Mock market data enabled because no live quote responses were available.", ...fallback.heatmapKeyMessages] };

  const stripCandidates: Array<Metric | null> = await Promise.all([
    quoteMetric("global-markets", "SPY", "S&P 500"),
    quoteMetric("global-markets", "QQQ", "Nasdaq 100"),
    quoteMetric("macro-heatmap", "USO", "WTI oil"),
    quoteMetric("macro-heatmap", "GLD", "Gold"),
    quoteMetric("crypto-heatmap", "BTC", "Bitcoin"),
    quoteMetric("macro-heatmap", "VIX", "VIX"),
    quoteMetric("macro-heatmap", "TNX", "U.S. 10-year yield")
  ]);
  const strip = stripCandidates.filter((metric): metric is Metric => Boolean(metric));

  return {
    payload: {
      ...fallback,
      strip: strip.length ? strip : fallback.strip,
      heatmaps: {
        globalMarkets: globalMarkets ?? fallback.heatmaps.globalMarkets,
        sectors: sectors ?? fallback.heatmaps.sectors,
        crypto: crypto ?? fallback.heatmaps.crypto,
        macro: macro ?? fallback.heatmaps.macro
      },
      heatmapKeyMessages: []
    },
    mode: "live",
    notices: []
  };
}

export async function getTodayPayload(): Promise<{ payload: TodayPayload; mode: "mock" | "live"; notices: string[] }> {
  const { payload: markets, mode } = await getMarketsPayload();
  const leading = [...markets.heatmaps.sectors].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
  const vix = await fetchFinnhubQuote("macro-heatmap", "VIX");
  const vix3m = await fetchFinnhubQuote("macro-heatmap", "VIX3M");
  const riskRatio = vix?.c && vix3m?.c ? (vix3m.c / vix.c).toFixed(2) : todayMock.marketSummary[1].value;
  const earnings = [...todayMock.earnings].slice(0, 3).map((event) => event.ticker).join(", ");

  return {
    payload: {
      ...todayMock,
      marketSummary: [
        { label: "Leading sectors", value: leading.map((item) => item.label).join(", "), change: leading.map((item) => formatPercent(item.changePercent)).join(" / "), tone: leading[0]?.changePercent >= 0 ? "positive" : "negative" },
        { label: "Risk-on / risk-off", value: riskRatio, change: "VIX3M / VIX", tone: "neutral" },
        { label: "Today’s earnings", value: `${todayMock.earnings.length} earnings`, change: earnings, tone: "neutral" },
        { label: "Put/call ratio", value: todayMock.marketSummary[3].value, change: todayMock.marketSummary[3].change, tone: "neutral" }
      ],
      keyStats: mode === "live" && markets.strip.length ? markets.strip : todayMock.keyStats,
      sectorSnapshot: leading.map((item) => ({ label: item.label, value: formatPercent(item.changePercent), tone: toneFromChange(item.changePercent) }))
    },
    mode,
    notices: mode === "live" ? [] : ["Mock Today cards enabled because live quote responses were unavailable."]
  };
}
