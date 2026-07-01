import type { FinnhubFeatureArea } from "./adapters/finnhub-key-router";
import {
  getSnapshotOrNull,
  isSnapshotFresh,
  upsertDashboardSnapshot
} from "./adapters/dashboard-snapshots";
import { getFinnhubKey } from "./adapters/finnhub-key-router";
import type { YahooMarketQuote } from "./adapters/yahoo-finance";
import { fetchYahooMarketQuote } from "./adapters/yahoo-finance";
import { flowMock, marketsMock, ownershipMock, todayMock } from "./fixtures/mock-dashboard";
import { fetchCryptoQuotes, cryptoAssets } from "./adapters/coingecko-crypto";
import { getLatestCboePutCallRatio } from "./adapters/cboe-put-call";
import { formatSignedPercent, recordMarketSummaryHistory } from "./market-summary-history";
import { formatEtDateKey } from "../utils/time";
import { getHeatmapIconPath, getMetricIconPath } from "../constants/asset-icons";
import {
  fetchUnusualWhalesFeaturedNews,
  fetchUnusualWhalesNewsFeed,
  unusualWhalesSources
} from "./adapters/unusual-whales-news";
import {
  buildInvestingEconomicCalendarWeekRange,
  fetchInvestingEconomicCalendar,
  investingEconomicSources,
  type InvestingEconomicEvent
} from "./adapters/investing-economic-calendar";
import type { UnusualWhalesEarningsEvent } from "./adapters/unusual-whales-earnings";
import { getCachedUnusualWhalesEarnings } from "./adapters/unusual-whales-earnings";
import { readDarkPoolRows } from "./adapters/unusual-whales-dark-pool";
import { readWhaleFeedRows } from "./adapters/unusual-whales-whale-feed";
import { readInsiderTradeRows } from "./adapters/unusual-whales-insider-trades";
import { INSIDER_TRADES_LOOKBACK_MONTHS } from "./insider-window";
import { DARK_POOL_RETENTION_DAYS } from "./adapters/unusual-whales-dark-pool";
import { aggregateInsiderTrades } from "./insider-aggregation";
import { deriveFlowSummary, WHALE_FEED_SUMMARY_WINDOW_DAYS } from "./flow-summary";
import { payloadContentHash, updateRefreshMetadata } from "./adapters/supabase-refresh";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import {
  getMajorEarningsForDate,
  groupEarningsBySession,
  sortByMarketCapDesc
} from "./earnings-utils";
import type { HeatmapTile, Metric, SourceMeta } from "./schemas/common";
import type {
  EconomicEvent,
  EarningsEvent,
  MarketsPayload,
  NewsCalendarPayload,
  DarkPoolFlowRow,
  FlowPayload,
  InsiderTradeDetailPayload,
  InsiderTradesPayload,
  OwnershipPayload,
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
  "crypto-heatmap": cryptoAssets,
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
      expectedEps: "—",
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

function getSelectableEarningsRange(dateKey = todayDateKey()) {
  const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
  return { minDate: addDaysToDateKey(startDate, -7), maxDate: addDaysToDateKey(endDate, 7) };
}

function formatEarningsCount(count: number) {
  return `${count} ${count === 1 ? "Earning" : "Earnings"}`;
}

function todayEarningsImportanceSubtext(events: UnusualWhalesEarningsEvent[]) {
  const priority = [
    { size: "big", singular: "Market Mover", plural: "Market Movers" },
    { size: "large", singular: "High Impact", plural: "High Impact" },
    { size: "mid", singular: "Moderate Impact", plural: "Moderate Impact" },
    { size: "small", singular: "Low Impact", plural: "Low Impact" }
  ];

  for (const category of priority) {
    const count = events.filter(
      (event) => event.marketCapSize?.trim().toLowerCase() === category.size
    ).length;
    if (count > 0) return `${count} ${count === 1 ? category.singular : category.plural}`;
  }

  return undefined;
}

function todayEarningsSummary(events: UnusualWhalesEarningsEvent[]) {
  return {
    count: events.length,
    value: formatEarningsCount(events.length),
    subtext: todayEarningsImportanceSubtext(events)
  };
}

function formatEconomicEventCount(count: number) {
  return `${count} ${count === 1 ? "Event" : "Events"}`;
}

export function formatImportantEconomicEventCount(
  significantCount: number,
  totalEventCount: number
) {
  return totalEventCount > 0 ? `${significantCount} Significant` : undefined;
}

function economicImportanceFromStars(
  stars: InvestingEconomicEvent["stars"]
): EconomicEvent["importance"] {
  if (stars === 3) return "High";
  if (stars === 2) return "Medium";
  return "Low";
}

function dashboardEventFromInvestingEvent(event: InvestingEconomicEvent): EconomicEvent {
  return {
    source: event.source,
    id: event.id,
    eventId: event.eventId,
    eventKey: event.eventKey,
    eventDate: event.eventDate,
    time: event.timestamp ?? event.time ?? "",
    timestamp: event.timestamp,
    event: event.eventName,
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    importance: economicImportanceFromStars(event.stars),
    stars: event.stars,
    isHighlighted: event.isHighlighted,
    highlightReason: event.highlightReason,
    fetchedAt: event.fetchedAt
  };
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function getEconomicCalendarEvents(dateKey = todayDateKey()) {
  const result = await fetchInvestingEconomicCalendar(dateKey);
  return {
    events: result.events
      .map(dashboardEventFromInvestingEvent)
      .filter((event) => event.eventDate === dateKey),
    mode: result.mode,
    message: result.message
  };
}

export async function getEconomicCalendarWeekEvents(dateKey = todayDateKey()) {
  const result = await fetchInvestingEconomicCalendar(dateKey);
  const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
  return {
    events: result.events
      .map(dashboardEventFromInvestingEvent)
      .filter((event) =>
        Boolean(event.eventDate && event.eventDate >= startDate && event.eventDate <= endDate)
      ),
    mode: result.mode,
    message: result.message
  };
}

export async function getEconomicCalendarAdjacentWeekEvents(dateKey = todayDateKey()) {
  const { startDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
  const weekStartDates = [
    addDaysToDateKey(startDate, -7),
    startDate,
    addDaysToDateKey(startDate, 7)
  ];
  const results = await Promise.all(
    weekStartDates.map((weekStart) => getEconomicCalendarWeekEvents(weekStart))
  );
  const events = Array.from(
    new Map(results.flatMap((result) => result.events).map((event) => [event.id, event])).values()
  ).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const messages = results.flatMap((result) => (result.message ? [result.message] : []));
  return {
    events,
    mode: results.some((result) => result.mode !== "live") ? "unavailable" : "live",
    message: messages.length ? Array.from(new Set(messages)).join(" ") : undefined
  };
}

function formatPutCallRatio(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--";
}

function putCallRatios(
  response: Awaited<ReturnType<typeof getLatestCboePutCallRatio>>["response"]
) {
  const ratios = response?.ratios;
  return {
    equity:
      typeof ratios?.equity === "number" && Number.isFinite(ratios.equity) ? ratios.equity : null,
    index: typeof ratios?.index === "number" && Number.isFinite(ratios.index) ? ratios.index : null,
    total:
      typeof ratios?.total === "number" && Number.isFinite(ratios.total)
        ? ratios.total
        : typeof response?.value === "number" && Number.isFinite(response.value)
          ? response.value
          : null
  };
}

function putCallValue(response: Awaited<ReturnType<typeof getLatestCboePutCallRatio>>["response"]) {
  return formatPutCallRatio(putCallRatios(response).total);
}

function putCallSentiment(total: number | null | undefined) {
  if (typeof total !== "number" || !Number.isFinite(total)) return "Signal unavailable";
  if (total > 1.2) return "Bearish";
  if (total < 0.8) return "Bullish";
  return "Neutral";
}

function yahooQuoteMetric(quote: YahooMarketQuote | null, label: string): Metric | null {
  if (!quote?.price) return null;
  const change = quote.change ?? 0;
  const changePercent = quote.changePercent ?? 0;
  const iconPath = getMetricIconPath(label);
  return {
    label,
    value: formatNumber(quote.price, { maximumFractionDigits: 2 }),
    change: formatChange(change),
    changePercent: formatPercent(changePercent),
    ...(iconPath ? { iconPath } : {}),
    tone: toneFromChange(changePercent)
  };
}

function unavailableMetric(label: string): Metric {
  const iconPath = getMetricIconPath(label);
  return {
    label,
    value: "—",
    change: "—",
    changePercent: "—",
    ...(iconPath ? { iconPath } : {}),
    tone: "neutral"
  };
}

async function todayMarketOverviewMetrics(
  cryptoQuotesResult?: Awaited<ReturnType<typeof fetchCryptoQuotes>>
) {
  const cryptoResult = cryptoQuotesResult ?? (await fetchCryptoQuotes());
  const bitcoin = cryptoResult.quotes.find((quote) => quote.symbol === "BTCUSD");
  const bitcoinMetric: Metric | null = bitcoin
    ? {
        label: "Bitcoin",
        value: formatNumber(bitcoin.price, { maximumFractionDigits: 2 }),
        change: "24h",
        changePercent: formatPercent(bitcoin.changePercent24h),
        iconPath: getMetricIconPath("Bitcoin"),
        tone: toneFromChange(bitcoin.changePercent24h)
      }
    : unavailableMetric("Bitcoin");

  const liveMetrics = await Promise.all([
    quoteMetric("global-markets", "SPY", "S&P 500"),
    quoteMetric("global-markets", "QQQ", "Nasdaq 100"),
    quoteMetric("macro-heatmap", "USO", "WTI Oil"),
    quoteMetric("macro-heatmap", "GLD", "Gold"),
    Promise.resolve(bitcoinMetric),
    fetchYahooMarketQuote("^VIX").then((quote) => yahooQuoteMetric(quote, "VIX"))
  ]);

  return liveMetrics
    .map(
      (metric, index) =>
        metric ??
        (index === 5
          ? unavailableMetric("VIX")
          : unavailableMetric(["S&P 500", "Nasdaq 100", "WTI Oil", "Gold", "Bitcoin"][index]))
    )
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

async function cryptoHeatmap(
  cryptoQuotesResult?: Awaited<ReturnType<typeof fetchCryptoQuotes>>
): Promise<HeatmapTile[] | null> {
  const result = cryptoQuotesResult ?? (await fetchCryptoQuotes());
  const rows = result.quotes.map((quote) => {
    const iconPath = getHeatmapIconPath(quote.symbol);
    return {
      symbol: quote.symbol,
      label: quote.label,
      value: quote.price,
      changePercent: quote.changePercent24h,
      weight: quote.weight,
      ...(iconPath ? { iconPath } : {})
    };
  });
  return rows.length === cryptoAssets.length ? rows : null;
}

async function heatmap(featureArea: FinnhubFeatureArea): Promise<HeatmapTile[] | null> {
  if (featureArea === "crypto-heatmap") return cryptoHeatmap();
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

async function buildMarketsPayload(): Promise<{
  payload: MarketsPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const fallback = marketsMock();
  const cryptoQuotesResult = await fetchCryptoQuotes();
  const [globalMarkets, sectors, crypto, macro] = await Promise.all([
    heatmap("global-markets"),
    heatmap("sectors-heatmap"),
    cryptoHeatmap(cryptoQuotesResult),
    heatmap("macro-heatmap")
  ]);

  const stripCandidates: Array<Metric | null> = await Promise.all([
    quoteMetric("global-markets", "SPY", "S&P 500"),
    quoteMetric("global-markets", "QQQ", "Nasdaq 100"),
    quoteMetric("global-markets", "IJH", "Mid Cap"),
    quoteMetric("global-markets", "IWM", "Small Cap"),
    fetchYahooMarketQuote("ES=F").then((quote) => yahooQuoteMetric(quote, "S&P 500 Futures"))
  ]);
  const strip = stripCandidates
    .map(
      (metric, index) =>
        metric ?? (index === 4 ? unavailableMetric("S&P 500 Futures") : fallback.strip[index])
    )
    .filter((metric): metric is Metric => Boolean(metric));

  const liveHeatmaps = { globalMarkets, sectors, crypto, macro };
  const hasLive = Object.values(liveHeatmaps).some(Boolean) || stripCandidates.some(Boolean);
  if (!hasLive)
    return {
      payload: {
        ...fallback,
        strip: strip.length ? strip : fallback.strip
      },
      mode: "mock",
      notices: [
        "Mock market data enabled because no live quote responses were available.",
        ...fallback.heatmapKeyMessages
      ]
    };

  return {
    payload: {
      ...fallback,
      strip: strip.length ? strip : fallback.strip,
      heatmaps: {
        globalMarkets: globalMarkets ?? fallback.heatmaps.globalMarkets,
        sectors: sectors ?? fallback.heatmaps.sectors,
        crypto: crypto ?? [],
        macro: macro ?? fallback.heatmaps.macro
      },
      heatmapKeyMessages: []
    },
    mode: "live",
    notices: []
  };
}

async function buildTodayPayload(): Promise<{
  payload: TodayPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const { payload: markets, mode } = await buildMarketsPayload();
  const leading = [...markets.heatmaps.sectors]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);
  const [vix, vix3m, putCallResult, cryptoQuotesResult] = await Promise.all([
    fetchYahooMarketQuote("^VIX"),
    fetchYahooMarketQuote("^VIX3M"),
    getLatestCboePutCallRatio(),
    fetchCryptoQuotes()
  ]);
  const vixValue = vix?.price;
  const vix3mValue = vix3m?.price;
  const hasValidRiskInputs =
    typeof vixValue === "number" &&
    Number.isFinite(vixValue) &&
    vixValue > 0 &&
    typeof vix3mValue === "number" &&
    Number.isFinite(vix3mValue) &&
    vix3mValue > 0;
  const riskRatio = hasValidRiskInputs ? (vix3mValue / vixValue).toFixed(2) : "—";
  const riskRatioValue = Number(riskRatio);
  const riskTone = Number.isFinite(riskRatioValue)
    ? riskRatioValue > 1
      ? "risk off"
      : riskRatioValue < 1
        ? "risk on"
        : "neutral"
    : undefined;
  const putCallRatioValues = putCallRatios(putCallResult.response);
  const historyResult = await recordMarketSummaryHistory([
    {
      metricKey: "risk_on_off_ratio",
      value: Number.isFinite(riskRatioValue) ? riskRatioValue : null,
      source: "Yahoo Finance VIX + VIX3M",
      freshness: hasValidRiskInputs ? "live" : "unavailable"
    },
    {
      metricKey: "put_call_total",
      value: putCallRatioValues.total,
      observedAt: putCallResult.response?.asOf,
      source: "Cboe Options Market Statistics",
      freshness: putCallResult.response?.freshness
    },
    {
      metricKey: "put_call_index",
      value: putCallRatioValues.index,
      observedAt: putCallResult.response?.asOf,
      source: "Cboe Options Market Statistics",
      freshness: putCallResult.response?.freshness
    },
    {
      metricKey: "put_call_equity",
      value: putCallRatioValues.equity,
      observedAt: putCallResult.response?.asOf,
      source: "Cboe Options Market Statistics",
      freshness: putCallResult.response?.freshness
    }
  ]);
  if (!historyResult.ok && historyResult.error) {
    console.error("market_summary_history_error", { error: historyResult.error });
  }
  const riskChange24h = formatSignedPercent(historyResult.changes.risk_on_off_ratio);
  const putCallChange24h = formatSignedPercent(historyResult.changes.put_call_total);
  const [featuredNewsResult, unusualWhalesEarningsResult, todayKeyStats, economicCalendarResult] =
    await Promise.all([
      fetchUnusualWhalesFeaturedNews(50),
      getCachedUnusualWhalesEarnings({ limit: 250, order: "oi" }),
      todayMarketOverviewMetrics(cryptoQuotesResult),
      getEconomicCalendarEvents(todayDateKey())
    ]);
  const todayEarnings = getMajorEarningsForDate(unusualWhalesEarningsResult.events, todayDateKey());
  const topTodayEarnings = todayEarnings.slice(0, 5);
  const earningsData = topTodayEarnings.length
    ? earningsSnapshotFromUnusualWhales(topTodayEarnings)
    : [];
  const earningsSummary = todayEarningsSummary(todayEarnings);
  const todayEconomicEvents = economicCalendarResult.events;
  const highlightedEconomicEventCount = todayEconomicEvents.filter(
    (event) => event.isHighlighted || event.eventKey
  ).length;

  return {
    payload: {
      ...todayMock,
      marketSummary: [
        {
          label: "Leading Sectors",
          value: leading.map((item) => sectorShortNames[item.symbol] ?? item.label).join(", "),
          change: leading.map((item) => formatPercent(item.changePercent)).join(" / "),
          tone: leading[0]?.changePercent >= 0 ? "positive" : "negative"
        },
        {
          label: "Risk On / Risk Off",
          value: riskRatio,
          change: riskTone,
          changePercent: riskChange24h,
          tone: "neutral"
        },
        {
          label: "Put/Call Ratio",
          value: putCallValue(putCallResult.response),
          change: putCallSentiment(putCallRatioValues.total),
          changePercent: putCallChange24h,
          putCallRatios: putCallRatioValues,
          putCallAsOf: putCallResult.response?.asOf ?? null,
          putCallFreshness: putCallResult.response?.freshness,
          tone: "neutral"
        },
        {
          label: "Today's Earnings",
          value: earningsSummary.value,
          change: earningsSummary.subtext,
          tone: "neutral"
        },
        {
          label: "Today's Economic Events",
          value: formatEconomicEventCount(todayEconomicEvents.length),
          change: formatImportantEconomicEventCount(
            highlightedEconomicEventCount,
            todayEconomicEvents.length
          ),
          tone: "neutral"
        }
      ],
      featuredNews: featuredNewsResult.items.length
        ? featuredNewsResult.items
        : todayMock.featuredNews,
      earnings: earningsData,
      unusualWhalesEarnings: todayEarnings,
      economicCalendar: todayEconomicEvents,
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
        liveMeta(
          "Investing.com Economic Calendar",
          investingEconomicSources().calendar,
          economicCalendarResult.mode === "live" ? "live" : "unavailable",
          economicCalendarResult.message
        ),
        liveMeta(
          "Cboe Options Market Statistics",
          "https://www.cboe.com/markets/us/options/market-statistics#current",
          putCallResult.mode,
          putCallResult.message
        ),
        liveMeta(
          "CoinGecko Crypto Quotes",
          "https://api.coingecko.com/api/v3/simple/price",
          cryptoQuotesResult.mode,
          cryptoQuotesResult.message
        ),
        liveMeta(
          "Yahoo Finance VIX + VIX3M",
          "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX3M",
          hasValidRiskInputs ? "live" : "unavailable",
          hasValidRiskInputs
            ? undefined
            : "Risk ratio requires valid positive Yahoo Finance ^VIX and ^VIX3M values."
        ),
        ...todayMock.sourceMeta.filter(
          (meta) =>
            meta.source !== "Unusual Whales Featured News" &&
            meta.source !== "Unusual Whales Economic Calendar"
        )
      ]
    },
    mode,
    notices:
      mode === "live"
        ? []
        : ["Mock Today cards enabled because live quote responses were unavailable."]
  };
}

async function buildNewsCalendarPayload(): Promise<{
  payload: NewsCalendarPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const dateKey = todayDateKey();
  const earningsRange = getSelectableEarningsRange(dateKey);
  const [newsResult, earningsData, unusualWhalesEarningsResult, economicCalendarResult] =
    await Promise.all([
      fetchUnusualWhalesNewsFeed(100),
      earningsWithLogos(),
      getCachedUnusualWhalesEarnings({
        minDate: earningsRange.minDate,
        maxDate: earningsRange.maxDate,
        limit: 250,
        order: "oi"
      }),
      getEconomicCalendarAdjacentWeekEvents(dateKey)
    ]);

  const fallbackNews = todayMock.featuredNews.map((article) => ({
    headline: article.title,
    timestamp: article.publishedAt ?? article.createdAt ?? article.fetchedAt,
    tickers: article.tags,
    whyItMatters: article.excerpt ?? "Featured market article.",
    source: "Unusual Whales",
    sourceUrl: article.sourceUrl
  }));
  const news = newsResult.items.length ? newsResult.items : fallbackNews;

  return {
    payload: {
      news,
      economicCalendar: economicCalendarResult.events,
      earnings: unusualWhalesEarningsResult.events.length
        ? earningsSnapshotFromUnusualWhales(unusualWhalesEarningsResult.events)
        : earningsData,
      unusualWhalesEarnings: unusualWhalesEarningsResult.events,
      earningsMetadata: unusualWhalesEarningsResult.metadata,
      earningsMessage: unusualWhalesEarningsResult.message,
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
        ),
        liveMeta(
          "Investing.com Economic Calendar",
          investingEconomicSources().calendar,
          economicCalendarResult.mode === "live" ? "live" : "unavailable",
          economicCalendarResult.message
        )
      ]
    },
    mode: newsResult.items.length ? "live" : "mock",
    notices: newsResult.message ? [newsResult.message] : []
  };
}

export async function refreshDashboardSnapshot(
  key:
    | "today:latest"
    | "markets:latest"
    | "news-calendar:latest"
    | "flow:latest"
    | "ownership:latest"
) {
  const builders = {
    "today:latest": { ttlSeconds: 15 * 60, build: buildTodayPayload },
    "markets:latest": { ttlSeconds: 10 * 60, build: buildMarketsPayload },
    "news-calendar:latest": { ttlSeconds: 45 * 60, build: buildNewsCalendarPayload },
    "flow:latest": { ttlSeconds: 24 * 60 * 60, build: buildFlowPayload },
    "ownership:latest": { ttlSeconds: 24 * 60 * 60, build: buildOwnershipPayload }
  } as const;
  const entry = builders[key];
  const result = await entry.build();
  const write = await upsertDashboardSnapshot(key, result.payload, {
    ttlSeconds: entry.ttlSeconds,
    mode: result.mode,
    notices: result.notices,
    metadata: {
      refreshedBy: "netlify-function",
      ...(key === "flow:latest" ? ((result.payload as FlowPayload).diagnostics ?? {}) : {})
    }
  });
  const supabase = createServerSupabaseClient();
  if (supabase.ok) {
    await updateRefreshMetadata(supabase.client, key, {
      ok: write.ok,
      changed: write.persisted ?? false,
      rowCount: write.persisted ? 1 : 0,
      contentHash: payloadContentHash([result.payload]),
      error: write.error ?? null,
      meta: {
        mode: result.mode,
        notices: result.notices,
        persisted: write.persisted ?? false,
        refreshedBy: "netlify-function",
        ...(key === "flow:latest" ? ((result.payload as FlowPayload).diagnostics ?? {}) : {})
      }
    }).catch((error) =>
      console.warn("dashboard_snapshot_metadata_write_failed", {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
  return { ...write, key, mode: result.mode, notices: result.notices };
}

async function getSnapshotFirstPayload<T>(
  key:
    | "today:latest"
    | "markets:latest"
    | "news-calendar:latest"
    | "flow:latest"
    | "ownership:latest",
  build: () => Promise<{ payload: T; mode: "mock" | "live"; notices: string[] }>,
  ttlSeconds: number
): Promise<{ payload: T; mode: "mock" | "live" | "cached"; notices: string[] }> {
  const cached = await getSnapshotOrNull<T>(key);
  if (cached.snapshot && isSnapshotFresh(cached.snapshot)) {
    return { payload: cached.snapshot.payload, mode: "cached", notices: cached.snapshot.notices };
  }
  if (cached.message) console.warn("dashboard_snapshot_read", { key, message: cached.message });

  try {
    const live = await build();
    const write = await upsertDashboardSnapshot(key, live.payload, {
      ttlSeconds,
      mode: live.mode,
      notices: live.notices,
      metadata: { refreshedBy: "server-fallback" }
    });
    if (!write.ok)
      console.warn("dashboard_snapshot_fallback_write_failed", { key, error: write.error });
    return live;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dashboard live fallback error";
    console.error("dashboard_snapshot_live_fallback_failed", { key, error: message });
    if (cached.snapshot) {
      return {
        payload: cached.snapshot.payload,
        mode: "cached",
        notices: [
          ...cached.snapshot.notices,
          `Showing stale cached ${key} because live refresh failed: ${message}`
        ]
      };
    }
    throw error;
  }
}

export async function getMarketsPayload(): Promise<{
  payload: MarketsPayload;
  mode: "mock" | "live" | "cached";
  notices: string[];
}> {
  return getSnapshotFirstPayload("markets:latest", buildMarketsPayload, 10 * 60);
}

export async function getTodayPayload(): Promise<{
  payload: TodayPayload;
  mode: "mock" | "live" | "cached";
  notices: string[];
}> {
  return getSnapshotFirstPayload("today:latest", buildTodayPayload, 15 * 60);
}

export async function getNewsCalendarPayload(): Promise<{
  payload: NewsCalendarPayload;
  mode: "mock" | "live" | "cached";
  notices: string[];
}> {
  return getSnapshotFirstPayload("news-calendar:latest", buildNewsCalendarPayload, 45 * 60);
}

export async function buildFlowPayload(): Promise<{
  payload: FlowPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) {
    return { payload: flowMock, mode: "mock", notices: [supabase.message] };
  }

  const notices: string[] = [];
  const readSection = async <T>(name: string, reader: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await reader();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unknown ${name} cache read error`;
      notices.push(`${name} Supabase cache unavailable: ${message}`);
      return [];
    }
  };

  const [darkPoolRows, insiderRows, whaleFeedRows] = await Promise.all([
    readSection("Dark Pool", () => readDarkPoolRows(supabase.client, 25)),
    readSection("Insider Trades", () => readInsiderTradeRows(supabase.client)),
    readSection("Whale Feed", () => readWhaleFeedRows(supabase.client, 100))
  ]);

  if (!darkPoolRows.length)
    notices.push("No cached Dark Pool rows found; using section fixture fallback.");
  if (!insiderRows.length)
    notices.push("No cached Insider Trades rows found; using section fixture fallback.");
  if (!whaleFeedRows.length)
    notices.push("No cached Whale Feed rows found; using section fixture fallback.");

  if (!darkPoolRows.length && !insiderRows.length && !whaleFeedRows.length) {
    return {
      payload: { ...flowMock, notices: ["No cached Flow rows found; using fixture fallback."] },
      mode: "mock",
      notices: ["No cached Flow rows found; using fixture fallback."]
    };
  }

  const insiderCompanies = aggregateInsiderTrades(insiderRows);
  const darkPool = darkPoolRows.length ? darkPoolRows : flowMock.darkPool;
  const whaleTrades = whaleFeedRows.length ? whaleFeedRows : flowMock.whaleTrades;
  const insiderTrades = (insiderCompanies.length ? insiderCompanies : flowMock.insiderTrades).slice(
    0,
    5
  );

  return {
    payload: {
      summary: deriveFlowSummary({ darkPool, insiderRows, whaleTrades }),
      darkPool,
      whaleTrades,
      insiderTrades,
      diagnostics: {
        insiderLookbackMonths: INSIDER_TRADES_LOOKBACK_MONTHS,
        insiderRowsUsed: insiderRows.length,
        insiderCompaniesAggregated: insiderCompanies.length,
        insiderSource: insiderRows.length ? "supabase/source-table" : "fixture-fallback",
        darkPoolWindowDays: DARK_POOL_RETENTION_DAYS,
        darkPoolRowsUsed: darkPoolRows.length,
        whaleFeedRowsUsed: whaleFeedRows.length,
        whaleFeedSource: whaleFeedRows.length ? "supabase/source-table" : "fixture-fallback"
      },
      sourceMeta: flowMock.sourceMeta,
      notices
    },
    mode: "live",
    notices
  };
}

async function readDarkPoolRowsFromFlowSnapshot(ticker: string, limit: number) {
  const cached = await getSnapshotOrNull<FlowPayload>("flow:latest");
  const upperTicker = ticker.toUpperCase();
  return (cached.snapshot?.payload.darkPool ?? [])
    .filter((row) => row.ticker.toUpperCase() === upperTicker)
    .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt))
    .slice(0, limit);
}

export async function getDarkPoolPayload(
  limit = 100,
  ticker?: string
): Promise<{
  payload: { rows: DarkPoolFlowRow[]; sourceMeta: SourceMeta[]; notices: string[] };
  mode: "mock" | "live";
  notices: string[];
}> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return {
      payload: {
        rows: ticker
          ? flowMock.darkPool.filter((r) => r.ticker === ticker.toUpperCase()).slice(0, limit)
          : flowMock.darkPool.slice(0, limit),
        sourceMeta: flowMock.sourceMeta,
        notices: [supabase.message]
      },
      mode: "mock",
      notices: [supabase.message]
    };
  try {
    const rows = await readDarkPoolRows(supabase.client, limit, ticker);
    const snapshotRows = ticker && !rows.length ? await readDarkPoolRowsFromFlowSnapshot(ticker, limit) : [];
    const resolvedRows = rows.length
      ? rows
      : snapshotRows.length
        ? snapshotRows
        : ticker
          ? flowMock.darkPool.filter((r) => r.ticker === ticker.toUpperCase()).slice(0, limit)
          : flowMock.darkPool.slice(0, limit);
    return {
      payload: {
        rows: resolvedRows,
        sourceMeta: flowMock.sourceMeta,
        notices: rows.length
          ? []
          : snapshotRows.length
            ? ["No ticker rows found in the source table; using cached Flow snapshot rows."]
            : ["No cached dark pool rows found; using fixture fallback."]
      },
      mode: rows.length || snapshotRows.length ? "live" : "mock",
      notices: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dark pool cache read error";
    return {
      payload: {
        rows: ticker ? [] : flowMock.darkPool.slice(0, limit),
        sourceMeta: flowMock.sourceMeta,
        notices: [message]
      },
      mode: "mock",
      notices: [message]
    };
  }
}

export async function getWhaleTradesPayload(ticker?: string): Promise<{
  payload: { rows: FlowPayload["whaleTrades"]; sourceMeta: SourceMeta[]; notices: string[] };
  mode: "mock" | "live";
  notices: string[];
}> {
  if (ticker) {
    const cached = await getSnapshotOrNull<FlowPayload>("flow:latest");
    if (
      cached.snapshot &&
      isSnapshotFresh(cached.snapshot) &&
      isUsableFlowSnapshot(cached.snapshot)
    ) {
      const snapshotRows = cached.snapshot.payload.whaleTrades
        .filter((r) => r.ticker === ticker.toUpperCase())
        .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
      if (snapshotRows.length) {
        return {
          payload: {
            rows: snapshotRows,
            sourceMeta: cached.snapshot.payload.sourceMeta,
            notices: cached.snapshot.notices
          },
          mode: "live",
          notices: cached.snapshot.notices
        };
      }
    }
  }
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return {
      payload: {
        rows: ticker
          ? flowMock.whaleTrades.filter((r) => r.ticker === ticker.toUpperCase())
          : flowMock.whaleTrades,
        sourceMeta: flowMock.sourceMeta,
        notices: [supabase.message]
      },
      mode: "mock",
      notices: [supabase.message]
    };
  try {
    const rows = await readWhaleFeedRows(supabase.client, 100, ticker);
    const notices = rows.length ? [] : ["No cached Whale Feed rows found; using fixture fallback."];
    const fallbackRows = ticker
      ? flowMock.whaleTrades.filter((r) => r.ticker === ticker.toUpperCase())
      : flowMock.whaleTrades;
    return {
      payload: {
        rows: rows.length ? rows : fallbackRows,
        sourceMeta: flowMock.sourceMeta,
        notices
      },
      mode: rows.length ? "live" : "mock",
      notices
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Whale Feed cache read error";
    return {
      payload: {
        rows: ticker
          ? flowMock.whaleTrades.filter((r) => r.ticker === ticker.toUpperCase())
          : flowMock.whaleTrades,
        sourceMeta: flowMock.sourceMeta,
        notices: [message]
      },
      mode: "mock",
      notices: [message]
    };
  }
}

export async function buildOwnershipPayload(): Promise<{
  payload: OwnershipPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  return { payload: ownershipMock, mode: "mock", notices: ownershipMock.notices };
}

function hasRevisedFlowSummary(payload: FlowPayload) {
  return (
    payload.summary.some((metric) => metric.label === "Insider sentiment") &&
    payload.summary.some((metric) => metric.label === `Whale Feed (${WHALE_FEED_SUMMARY_WINDOW_DAYS}D)`)
  );
}

function hasExplanatoryDarkPool30dVolumeSubtext(payload: FlowPayload) {
  const darkPoolMetric = payload.summary.find(
    (metric) => metric.label === `Largest Dark Pool Print (${DARK_POOL_RETENTION_DAYS}D)`
  );
  return (
    !darkPoolMetric?.subtext ||
    darkPoolMetric.subtext === "—" ||
    darkPoolMetric.subtext.endsWith(" of 30D Vol")
  );
}

function isUsableFlowSnapshot(snapshot: {
  mode: string | null;
  payload: FlowPayload;
  metadata?: Record<string, unknown>;
}) {
  const metadata = snapshot.metadata ?? {};
  const snapshotRows =
    typeof metadata.insiderRowsUsed === "number"
      ? metadata.insiderRowsUsed
      : snapshot.payload.diagnostics?.insiderRowsUsed;
  return (
    snapshot.mode !== "mock" &&
    hasRevisedFlowSummary(snapshot.payload) &&
    hasExplanatoryDarkPool30dVolumeSubtext(snapshot.payload) &&
    snapshot.payload.diagnostics?.insiderLookbackMonths === INSIDER_TRADES_LOOKBACK_MONTHS &&
    snapshot.payload.diagnostics?.insiderSource === "supabase/source-table" &&
    snapshot.payload.diagnostics?.whaleFeedSource !== undefined &&
    typeof snapshotRows === "number"
  );
}

export async function getFlowPayload(): Promise<{
  payload: FlowPayload;
  mode: "mock" | "live" | "cached";
  notices: string[];
}> {
  const key = "flow:latest";
  const cached = await getSnapshotOrNull<FlowPayload>(key);
  if (
    cached.snapshot &&
    isSnapshotFresh(cached.snapshot) &&
    isUsableFlowSnapshot(cached.snapshot)
  ) {
    return { payload: cached.snapshot.payload, mode: "cached", notices: cached.snapshot.notices };
  }

  if (cached.snapshot && cached.snapshot.mode === "mock") {
    console.warn("dashboard_snapshot_mock_bypassed", {
      key,
      generatedAt: cached.snapshot.generatedAt,
      reason: "Flow source tables may contain real rows; rebuilding before using fixture snapshot."
    });
  } else if (cached.snapshot && !hasRevisedFlowSummary(cached.snapshot.payload)) {
    console.warn("dashboard_snapshot_flow_summary_bypassed", {
      key,
      generatedAt: cached.snapshot.generatedAt,
      reason: "Flow snapshot is missing revised Insider sentiment summary fields; rebuilding."
    });
  } else if (cached.snapshot && !hasExplanatoryDarkPool30dVolumeSubtext(cached.snapshot.payload)) {
    console.warn("dashboard_snapshot_flow_summary_bypassed", {
      key,
      generatedAt: cached.snapshot.generatedAt,
      reason:
        "Flow snapshot is missing explanatory Largest Dark Pool Print 30D volume subtext; rebuilding."
    });
  } else if (cached.message) {
    console.warn("dashboard_snapshot_read", { key, message: cached.message });
  }

  try {
    const live = await buildFlowPayload();
    const shouldPersist = live.mode !== "mock";
    if (shouldPersist) {
      const write = await upsertDashboardSnapshot(key, live.payload, {
        ttlSeconds: 24 * 60 * 60,
        mode: live.mode,
        notices: live.notices,
        metadata: {
          refreshedBy: "server-fallback",
          skippedMockSnapshot: cached.snapshot?.mode === "mock",
          ...live.payload.diagnostics
        }
      });
      if (!write.ok)
        console.warn("dashboard_snapshot_fallback_write_failed", { key, error: write.error });
    }
    return live;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Flow live fallback error";
    console.error("dashboard_snapshot_live_fallback_failed", { key, error: message });
    if (cached.snapshot) {
      return {
        payload: cached.snapshot.payload,
        mode: cached.snapshot.mode === "mock" ? "mock" : "cached",
        notices: [
          ...cached.snapshot.notices,
          `Showing cached ${key} because source-table refresh failed: ${message}`
        ]
      };
    }
    throw error;
  }
}

export async function getOwnershipPayload(): Promise<{
  payload: OwnershipPayload;
  mode: "mock" | "live" | "cached";
  notices: string[];
}> {
  return getSnapshotFirstPayload("ownership:latest", buildOwnershipPayload, 24 * 60 * 60);
}

export async function getInsiderTradesPayload(
  limit = 25
): Promise<{ payload: InsiderTradesPayload; mode: "mock" | "live"; notices: string[] }> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return {
      payload: {
        companies: flowMock.insiderTrades.slice(0, limit),
        sourceMeta: flowMock.sourceMeta,
        notices: [supabase.message]
      },
      mode: "mock",
      notices: [supabase.message]
    };
  try {
    const rows = await readInsiderTradeRows(supabase.client);
    const companies = aggregateInsiderTrades(rows).slice(0, limit);
    return {
      payload: {
        companies: companies.length ? companies : flowMock.insiderTrades.slice(0, limit),
        sourceMeta: flowMock.sourceMeta,
        notices: companies.length ? [] : ["No cached insider rows found; using fixture fallback."]
      },
      mode: companies.length ? "live" : "mock",
      notices: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown insider cache read error";
    return {
      payload: {
        companies: flowMock.insiderTrades.slice(0, limit),
        sourceMeta: flowMock.sourceMeta,
        notices: [message]
      },
      mode: "mock",
      notices: [message]
    };
  }
}

export async function getInsiderTradeDetailPayload(
  ticker: string
): Promise<{ payload: InsiderTradeDetailPayload; mode: "mock" | "live"; notices: string[] }> {
  const symbol = ticker.toUpperCase();
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return {
      payload: {
        ticker: symbol,
        aggregate: flowMock.insiderTrades.find((r) => r.ticker === symbol) ?? null,
        trades: [],
        sourceMeta: flowMock.sourceMeta,
        notices: [supabase.message]
      },
      mode: "mock",
      notices: [supabase.message]
    };
  try {
    const trades = await readInsiderTradeRows(supabase.client, symbol, 2000);
    const aggregate = aggregateInsiderTrades(trades)[0] ?? null;
    return {
      payload: {
        ticker: symbol,
        aggregate,
        trades,
        sourceMeta: flowMock.sourceMeta,
        notices: trades.length ? [] : ["No cached insider detail rows found for this ticker."]
      },
      mode: trades.length ? "live" : "mock",
      notices: []
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown insider detail cache read error";
    return {
      payload: {
        ticker: symbol,
        aggregate: null,
        trades: [],
        sourceMeta: flowMock.sourceMeta,
        notices: [message]
      },
      mode: "mock",
      notices: [message]
    };
  }
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}
