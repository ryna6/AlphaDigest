import type { FinnhubFeatureArea } from "./adapters/finnhub-key-router";
import { getFinnhubKey } from "./adapters/finnhub-key-router";
import { marketsMock, todayMock } from "./fixtures/mock-dashboard";
import { formatEtDateKey } from "../utils/time";
import { getHeatmapIconPath, getMetricIconPath } from "../constants/asset-icons";
import {
  fetchUnusualWhalesFeaturedNews,
  fetchUnusualWhalesNewsFeed,
  unusualWhalesSources
} from "./adapters/unusual-whales-news";
import type { UnusualWhalesEarningsEvent } from "./adapters/unusual-whales-earnings";
import { getCachedUnusualWhalesEarnings } from "./adapters/unusual-whales-earnings";
import {
  getMajorEarningsForDate,
  groupEarningsBySession,
  sortByMarketCapDesc
} from "./earnings-utils";
import type { HeatmapTile, Metric, SourceMeta } from "./schemas/common";
import type {
  EarningsEvent,
  MarketsPayload,
  NewsCalendarPayload,
  TodayPayload
} from "./schemas/dashboard";

const sectorShortNames: Record<string, string> = {
  XLK: "Tech",
  XLF: "Financials",
  XLC: "Comm Services",
  XLY: "Consumer Discretionary",
  XLI: "Industrials",
  XLV: "Healthcare",
  XLP: "Consumer Staples",
  XLU: "Utilities",
  XLB: "Materials",
  XLE: "Energy",
  XLRE: "Real Estate",
  SMH: "Semis"
};

const quoteSymbols: Record<
  FinnhubFeatureArea,
  Array<{ symbol: string; label: string; weight: number; fetchSymbol?: string }>
> = {
  "global-markets": [
    { symbol: "SPY", label: "U.S. Market", weight: 20 },
    { symbol: "EWC", label: "Canadian Market", weight: 10 },
    { symbol: "IEUR", label: "European Market", weight: 14 },
    { symbol: "EWJ", label: "Japan Market", weight: 12 },
    { symbol: "EWT", label: "Taiwan Market", weight: 10 },
    { symbol: "EWH", label: "Hong Kong Market", weight: 8 },
    { symbol: "EWY", label: "Korean Market", weight: 8 },
    { symbol: "INDA", label: "Indian Market", weight: 10 }
  ],
  "sectors-heatmap": [
    { symbol: "XLK", label: "Technology", weight: 18 },
    { symbol: "XLF", label: "Financials", weight: 13 },
    { symbol: "XLC", label: "Communication Services", weight: 10 },
    { symbol: "XLY", label: "Consumer Discretionary", weight: 11 },
    { symbol: "XLI", label: "Industrials", weight: 10 },
    { symbol: "XLV", label: "Healthcare", weight: 12 },
    { symbol: "XLP", label: "Consumer Staples", weight: 8 },
    { symbol: "XLU", label: "Utilities", weight: 8 },
    { symbol: "XLB", label: "Materials", weight: 8 },
    { symbol: "XLE", label: "Energy", weight: 10 },
    { symbol: "XLRE", label: "Real Estate", weight: 7 },
    { symbol: "SMH", label: "Semiconductors", weight: 12 }
  ],
  "crypto-heatmap": [
    { symbol: "BTCUSD", fetchSymbol: "BINANCE:BTCUSDT", label: "Bitcoin", weight: 28 },
    { symbol: "ETHUSD", fetchSymbol: "BINANCE:ETHUSDT", label: "Ethereum", weight: 22 },
    { symbol: "SOLUSD", fetchSymbol: "BINANCE:SOLUSDT", label: "Solana", weight: 12 },
    { symbol: "XRPUSD", fetchSymbol: "BINANCE:XRPUSDT", label: "XRP", weight: 8 },
    { symbol: "BNBUSD", fetchSymbol: "BINANCE:BNBUSDT", label: "BNB", weight: 8 },
    { symbol: "TRXUSD", fetchSymbol: "BINANCE:TRXUSDT", label: "TRON", weight: 6 },
    { symbol: "ADAUSD", fetchSymbol: "BINANCE:ADAUSDT", label: "Cardano", weight: 6 },
    { symbol: "DOGEUSD", fetchSymbol: "BINANCE:DOGEUSDT", label: "Dogecoin", weight: 6 }
  ],
  "macro-heatmap": [
    { symbol: "GLD", label: "Gold", weight: 12 },
    { symbol: "SLV", label: "Silver", weight: 8 },
    { symbol: "USO", label: "Crude Oil", weight: 10 },
    { symbol: "UNG", label: "Natural Gas", weight: 8 },
    { symbol: "SHY", label: "Short-Term Bonds", weight: 10 },
    { symbol: "TLT", label: "Long-Term Bonds", weight: 12 },
    { symbol: "HYG", label: "High-Risk Corporate Bonds", weight: 10 },
    { symbol: "UUP", label: "Dollar Index", weight: 10 }
  ]
};

type FinnhubQuote = { c?: number; d?: number; dp?: number; pc?: number };
type FinnhubCompanyProfile = { logo?: string };

const companyLogoCache = new Map<string, Promise<string | undefined>>();

function liveMeta(
  source: string,
  sourceUrl: string,
  mode: SourceMeta["mode"],
  message?: string
): SourceMeta {
  return {
    source,
    sourceUrl,
    lastUpdated: new Date().toISOString(),
    mode,
    ...(message ? { message } : {})
  };
}

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

async function fetchFinnhubQuote(
  featureArea: FinnhubFeatureArea,
  symbol: string
): Promise<FinnhubQuote | null> {
  const route = getFinnhubKey(featureArea);
  if (!route.ok) return null;

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${route.key}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) return null;
    const quote = (await response.json()) as FinnhubQuote;
    if (!quote.c || quote.c <= 0) return null;
    return quote;
  } catch {
    return null;
  }
}

async function quoteMetric(
  featureArea: FinnhubFeatureArea,
  symbol: string,
  label: string
): Promise<Metric | null> {
  const quote = await fetchFinnhubQuote(featureArea, symbol);
  if (!quote?.c) return null;
  const change = quote.d ?? (quote.pc ? quote.c - quote.pc : 0);
  const changePercent = quote.dp ?? (quote.pc ? (change / quote.pc) * 100 : 0);
  const iconPath = getMetricIconPath(label);
  return {
    label,
    value: formatNumber(quote.c, { maximumFractionDigits: 2 }),
    change: formatChange(change),
    changePercent: formatPercent(changePercent),
    ...(iconPath ? { iconPath } : {}),
    tone: toneFromChange(changePercent)
  };
}

async function fetchFinnhubCompanyLogo(symbol: string): Promise<string | undefined> {
  const normalizedSymbol = symbol.toUpperCase();
  const cached = companyLogoCache.get(normalizedSymbol);
  if (cached) return cached;

  const request = (async () => {
    const route = getFinnhubKey("global-markets");
    if (!route.ok) return undefined;

    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(normalizedSymbol)}&token=${route.key}`,
      {
        next: { revalidate: 60 * 60 * 24 }
      }
    );

    if (!response.ok) return undefined;
    const profile = (await response.json()) as FinnhubCompanyProfile;
    return profile.logo || undefined;
  })();

  companyLogoCache.set(normalizedSymbol, request);
  return request;
}

function earningsTimingFromReportTime(reportTime: string | null): EarningsEvent["time"] {
  if (reportTime === "premarket") return "BMO";
  if (reportTime === "postmarket") return "AMC";
  return "TBD";
}

function currencyOrDash(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function compactMoneyOrDash(value: number | null) {
  if (value === null || !Number.isFinite(value)) return undefined;
  const abs = Math.abs(value);
  const format = (divisor: number, suffix: string) =>
    `$${(abs / divisor).toFixed(abs / divisor >= 10 ? 1 : 2).replace(/\.0+$/, "")}${suffix}`;
  if (abs >= 1_000_000_000_000) return format(1_000_000_000_000, "T");
  if (abs >= 1_000_000_000) return format(1_000_000_000, "B");
  if (abs >= 1_000_000) return format(1_000_000, "M");
  return currencyOrDash(value);
}

function earningsSnapshotFromUnusualWhales(events: UnusualWhalesEarningsEvent[]): EarningsEvent[] {
  return sortByMarketCapDesc(events)
    .slice(0, 20)
    .map((event) => ({
      ticker: event.symbol,
      company: event.companyName ?? event.symbol,
      time: earningsTimingFromReportTime(event.reportTime),
      expectedEps: currencyOrDash(event.epsMeanEstimate ?? event.streetMeanEstimate),
      expectedRevenue: undefined,
      actualEps: "—",
      actualRevenue: "—",
      marketCap: compactMoneyOrDash(event.marketCap),
      ...(event.logo ? { logoUrl: event.logo } : {})
    }));
}

function todayDateKey(date = new Date()) {
  return formatEtDateKey(date) ?? date.toISOString().slice(0, 10);
}

function todayEarningsSummary(events: UnusualWhalesEarningsEvent[]) {
  const groups = groupEarningsBySession(events);
  const beforeOpen = groups.premarket.length;
  const afterClose = groups.postmarket.length;
  const regular = groups.regular.length;
  const sessionCounts = [
    beforeOpen ? `${beforeOpen} before open` : null,
    afterClose ? `${afterClose} after close` : null,
    regular ? `${regular} regular` : null
  ].filter((value): value is string => Boolean(value));

  return {
    count: events.length,
    value: `${events.length} ${events.length === 1 ? "earning" : "earnings"}`,
    change: sessionCounts.length
      ? sessionCounts.join(" • ")
      : events.length
        ? "Large-cap earnings today"
        : "No major earnings today"
  };
}

async function todayMarketOverviewMetrics() {
  const fallbackMetrics = todayMock.keyStats.slice(0, 6).map((metric) => ({
    ...metric,
    iconPath: getMetricIconPath(metric.label)
  }));

  const liveMetrics = await Promise.all([
    quoteMetric("global-markets", "SPY", "S&P 500"),
    quoteMetric("global-markets", "QQQ", "Nasdaq 100"),
    quoteMetric("macro-heatmap", "USO", "WTI Oil"),
    quoteMetric("macro-heatmap", "GLD", "Gold"),
    quoteMetric("crypto-heatmap", "BINANCE:BTCUSDT", "Bitcoin"),
    quoteMetric("macro-heatmap", "^VIX", "VIX")
  ]);

  return liveMetrics
    .map((metric, index) => metric ?? fallbackMetrics[index])
    .filter((metric): metric is Metric => Boolean(metric));
}

async function earningsWithLogos() {
  return Promise.all(
    todayMock.earnings.map(async (event) => {
      const logoUrl = await fetchFinnhubCompanyLogo(event.ticker);
      return logoUrl ? { ...event, logoUrl } : event;
    })
  );
}

async function heatmap(featureArea: FinnhubFeatureArea): Promise<HeatmapTile[] | null> {
  const rows = await Promise.all(
    quoteSymbols[featureArea].map(async (item) => {
      const quote = await fetchFinnhubQuote(featureArea, item.fetchSymbol ?? item.symbol);
      if (!quote?.c) return null;
      const changePercent = quote.dp ?? 0;
      const iconPath = getHeatmapIconPath(item.symbol);
      return {
        symbol: item.symbol,
        label: item.label,
        value: quote.c,
        changePercent,
        weight: item.weight,
        ...(iconPath ? { iconPath } : {})
      };
    })
  );

  const valid = rows.filter((row): row is HeatmapTile => Boolean(row));
  return valid.length ? valid : null;
}

export async function getMarketsPayload(): Promise<{
  payload: MarketsPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const fallback = marketsMock();
  const [globalMarkets, sectors, crypto, macro] = await Promise.all([
    heatmap("global-markets"),
    heatmap("sectors-heatmap"),
    heatmap("crypto-heatmap"),
    heatmap("macro-heatmap")
  ]);

  const liveHeatmaps = { globalMarkets, sectors, crypto, macro };
  const hasLive = Object.values(liveHeatmaps).some(Boolean);
  if (!hasLive)
    return {
      payload: fallback,
      mode: "mock",
      notices: [
        "Mock market data enabled because no live quote responses were available.",
        ...fallback.heatmapKeyMessages
      ]
    };

  const stripCandidates: Array<Metric | null> = await Promise.all([
    quoteMetric("global-markets", "SPY", "S&P 500"),
    quoteMetric("global-markets", "QQQ", "Nasdaq 100"),
    quoteMetric("global-markets", "IJH", "Mid Cap"),
    quoteMetric("global-markets", "IWM", "Small Cap"),
    quoteMetric("global-markets", "ES1!", "S&P 500 Futures")
  ]);
  const strip = stripCandidates
    .map((metric, index) => metric ?? fallback.strip[index])
    .filter((metric): metric is Metric => Boolean(metric));

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

export async function getTodayPayload(): Promise<{
  payload: TodayPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const { payload: markets, mode } = await getMarketsPayload();
  const leading = [...markets.heatmaps.sectors]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);
  const vix = await fetchFinnhubQuote("macro-heatmap", "^VIX");
  const vix3m = await fetchFinnhubQuote("macro-heatmap", "VIX3M");
  const riskRatio =
    vix?.c && vix3m?.c ? (vix3m.c / vix.c).toFixed(2) : todayMock.marketSummary[1].value;
  const riskRatioValue = Number(riskRatio);
  const riskTone = Number.isFinite(riskRatioValue)
    ? riskRatioValue > 1
      ? "risk off"
      : riskRatioValue < 1
        ? "risk on"
        : "neutral"
    : todayMock.marketSummary[1].change;
  const [featuredNewsResult, unusualWhalesEarningsResult, todayKeyStats] = await Promise.all([
    fetchUnusualWhalesFeaturedNews(50),
    getCachedUnusualWhalesEarnings({ limit: 250, order: "oi" }),
    todayMarketOverviewMetrics()
  ]);
  const todayEarnings = getMajorEarningsForDate(unusualWhalesEarningsResult.events, todayDateKey());
  const topTodayEarnings = todayEarnings.slice(0, 5);
  const earningsData = topTodayEarnings.length
    ? earningsSnapshotFromUnusualWhales(topTodayEarnings)
    : [];
  const earningsSummary = todayEarningsSummary(todayEarnings);

  return {
    payload: {
      ...todayMock,
      marketSummary: [
        {
          label: "Leading sectors",
          value: leading.map((item) => sectorShortNames[item.symbol] ?? item.label).join(", "),
          change: leading.map((item) => formatPercent(item.changePercent)).join(" / "),
          tone: leading[0]?.changePercent >= 0 ? "positive" : "negative"
        },
        { label: "Risk-on / risk-off", value: riskRatio, change: riskTone, tone: "neutral" },
        {
          label: "Today’s earnings",
          value: earningsSummary.value,
          change: earningsSummary.change,
          tone: "neutral"
        },
        {
          label: "Put/call ratio",
          value: todayMock.marketSummary[3].value,
          change: todayMock.marketSummary[3].change,
          tone: "neutral"
        }
      ],
      featuredNews: featuredNewsResult.items.length
        ? featuredNewsResult.items
        : todayMock.featuredNews,
      earnings: earningsData,
      unusualWhalesEarnings: todayEarnings,
      keyStats: todayKeyStats,
      sectorSnapshot: leading.map((item) => ({
        label: item.label,
        value: formatPercent(item.changePercent),
        tone: toneFromChange(item.changePercent)
      })),
      sourceMeta: [
        liveMeta(
          "Unusual Whales Featured News",
          unusualWhalesSources.featured,
          featuredNewsResult.mode,
          featuredNewsResult.message
        ),
        ...todayMock.sourceMeta.filter((meta) => meta.source !== "Unusual Whales Featured News")
      ]
    },
    mode,
    notices:
      mode === "live"
        ? []
        : ["Mock Today cards enabled because live quote responses were unavailable."]
  };
}

export async function getNewsCalendarPayload(): Promise<{
  payload: NewsCalendarPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const [newsResult, earningsData, unusualWhalesEarningsResult] = await Promise.all([
    fetchUnusualWhalesNewsFeed(100),
    earningsWithLogos(),
    getCachedUnusualWhalesEarnings({ limit: 250, order: "oi" })
  ]);

  const fallbackNews = todayMock.featuredNews.map((article) => ({
    headline: article.title,
    timestamp: article.publishedAt ?? article.createdAt ?? article.fetchedAt,
    tickers: article.tags,
    whyItMatters: article.excerpt ?? "Featured market article.",
    source: "Unusual Whales",
    sourceUrl: article.sourceUrl,
    category: "Market",
    impact: "Medium" as const
  }));
  const news = newsResult.items.length ? newsResult.items : fallbackNews;

  return {
    payload: {
      news,
      economicCalendar: todayMock.economicCalendar,
      earnings: unusualWhalesEarningsResult.events.length
        ? earningsSnapshotFromUnusualWhales(unusualWhalesEarningsResult.events)
        : earningsData,
      unusualWhalesEarnings: unusualWhalesEarningsResult.events,
      earningsMetadata: unusualWhalesEarningsResult.metadata,
      sourceMeta: [
        liveMeta(
          "Unusual Whales News Feed",
          unusualWhalesSources.feed,
          newsResult.mode,
          newsResult.message
        ),
        liveMeta(
          "Unusual Whales Earnings Cache",
          "https://phx.unusualwhales.com/api/companies_earnings/upcoming_earnings_v2",
          unusualWhalesEarningsResult.mode === "supabase" ||
            unusualWhalesEarningsResult.mode === "live"
            ? "live"
            : "unavailable",
          unusualWhalesEarningsResult.message
        )
      ]
    },
    mode: newsResult.items.length ? "live" : "mock",
    notices: newsResult.message ? [newsResult.message] : []
  };
}
