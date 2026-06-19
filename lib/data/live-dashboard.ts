import type { FinnhubFeatureArea } from "./adapters/finnhub-key-router";
import { getFinnhubKey } from "./adapters/finnhub-key-router";
import type { YahooMarketQuote } from "./adapters/yahoo-finance";
import { fetchYahooMarketQuote } from "./adapters/yahoo-finance";
import { marketsMock, todayMock } from "./fixtures/mock-dashboard";
import { fetchCryptoQuotes, cryptoAssets } from "./adapters/coingecko-crypto";
import { getLatestCboePutCallRatio } from "./adapters/cboe-put-call";
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

function getSelectableEarningsRange(dateKey = todayDateKey()) {
  const { startDate, endDate } = buildInvestingEconomicCalendarWeekRange(dateKey);
  return { minDate: addDaysToDateKey(startDate, -7), maxDate: addDaysToDateKey(endDate, 7) };
}

function formatEarningsCount(count: number) {
  return `${count} ${count === 1 ? "Earning" : "Earnings"}`;
}

function todayEarningsSummary(events: UnusualWhalesEarningsEvent[]) {
  return {
    count: events.length,
    value: formatEarningsCount(events.length)
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
    country: event.country,
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

function putCallValue(response: Awaited<ReturnType<typeof getLatestCboePutCallRatio>>["response"]) {
  const ratios = response?.ratios;
  return [
    `Equity: ${formatPutCallRatio(ratios?.equity)}`,
    `Index: ${formatPutCallRatio(ratios?.index)}`,
    `Total: ${formatPutCallRatio(ratios?.total)}`
  ].join("\n");
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

export async function getMarketsPayload(): Promise<{
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

export async function getTodayPayload(): Promise<{
  payload: TodayPayload;
  mode: "mock" | "live";
  notices: string[];
}> {
  const { payload: markets, mode } = await getMarketsPayload();
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
        { label: "Risk On / Risk Off", value: riskRatio, change: riskTone, tone: "neutral" },
        {
          label: "Put/Call Ratio",
          value: putCallValue(putCallResult.response),
          change: putCallResult.response?.asOf
            ? `ET ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(putCallResult.response.asOf))}`
            : undefined,
          tone: "neutral"
        },
        {
          label: "Today's Earnings",
          value: earningsSummary.value,
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

export async function getNewsCalendarPayload(): Promise<{
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
    sourceUrl: article.sourceUrl,
    category: "Market",
    impact: "Medium" as const
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
