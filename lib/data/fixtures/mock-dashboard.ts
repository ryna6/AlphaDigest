import { getHeatmapIconPath, getMetricIconPath } from "../../constants/asset-icons";
import type { Metric } from "../schemas/common";
import type {
  FlowPayload,
  OwnershipPayload,
  MarketsPayload,
  TickerPayload,
  TodayPayload
} from "../schemas/dashboard";
import { getFinnhubKeyStatus } from "../adapters/finnhub-key-router";

const now = "2026-06-05T13:30:00-04:00";
const mockMeta = (source: string, sourceUrl?: string) => ({
  source,
  sourceUrl,
  lastUpdated: now,
  mode: "mock" as const,
  message:
    "Mock data enabled. Configure required Netlify environment variables and ingestion jobs to enable live data."
});

export const todayMock: TodayPayload = {
  summary: {
    title: "Mixed tape with risk appetite selective, not broad.",
    regime: "Neutral / Choppy",
    bullets: [
      "Leadership is concentrated in technology and communication services while defensive groups lag.",
      "VIX is contained, but breadth is only neutral, so follow-through matters more than index level.",
      "Oil and yields are the key cross-asset checks for today's risk tone."
    ]
  },
  marketSummary: [
    {
      label: "Leading Sectors",
      value: "Tech, Comm Services, Energy",
      change: "+0.82% / +0.61% / +0.44%",
      tone: "positive"
    },
    { label: "Risk On / Risk Off", value: "1.22", change: "risk off", tone: "neutral" },
    {
      label: "Put/Call Ratio",
      value: "Equity: 0.61\nIndex: 1.22\nTotal: 0.91",
      change: "Neutral",
      putCallRatios: { equity: 0.61, index: 1.22, total: 0.91 },
      putCallAsOf: now,
      putCallFreshness: "fixture",
      tone: "neutral"
    },
    { label: "Today's Earnings", value: "1 Earning", tone: "neutral" },
    {
      label: "Today's Economic Events",
      value: "2 Events",
      change: "1 Very Important",
      tone: "neutral"
    }
  ],
  keyStats: [
    {
      label: "S&P 500",
      value: "5,352.96",
      change: "+18.12",
      changePercent: "+0.34%",
      tone: "positive"
    },
    {
      label: "Nasdaq 100",
      value: "17,098.45",
      change: "+91.43",
      changePercent: "+0.54%",
      tone: "positive"
    },
    {
      label: "WTI Oil",
      value: "$78.28",
      change: "+$0.42",
      changePercent: "+0.54%",
      tone: "warning"
    },
    {
      label: "Gold",
      value: "$2,336.20",
      change: "+$5.10",
      changePercent: "+0.22%",
      tone: "neutral"
    },
    {
      label: "Bitcoin",
      value: "$68,420",
      change: "+$710",
      changePercent: "+1.05%",
      tone: "positive"
    },
    { label: "VIX", value: "13.42", change: "-0.38", changePercent: "-2.75%", tone: "positive" },
    {
      label: "Mid Cap",
      value: "60.42",
      change: "+0.18",
      changePercent: "+0.30%",
      tone: "positive"
    },
    {
      label: "Small Cap",
      value: "202.16",
      change: "-0.54",
      changePercent: "-0.27%",
      tone: "negative"
    },
    {
      label: "S&P 500 Futures",
      value: "5,361.25",
      change: "+12.50",
      changePercent: "+0.23%",
      tone: "positive"
    }
  ],
  featuredNews: [
    {
      slug: "mega-cap-technology-leads-premarket-tape",
      title: "Mega-cap technology leads premarket tape as yields edge higher",
      publishedAt: "2026-06-05T12:42:00.000Z",
      createdAt: "2026-06-05T12:30:00.000Z",
      fetchedAt: "2026-06-05T12:45:00.000Z",
      tags: ["QQQ", "XLK", "Macro"],
      excerpt: "Leadership remains narrow, keeping breadth confirmation important.",
      contentHtml:
        "Mega-cap technology shares are leading the premarket tape while yields edge higher. Traders are watching whether breadth can confirm the move after the opening bell.",
      sourceUrl: "https://unusualwhales.com/news/mega-cap-technology-leads-premarket-tape"
    },
    {
      slug: "energy-complex-firms-on-crude-supply-headlines",
      title: "Energy complex firms as traders watch crude supply headlines",
      publishedAt: "2026-06-05T12:12:00.000Z",
      createdAt: "2026-06-05T12:00:00.000Z",
      fetchedAt: "2026-06-05T12:15:00.000Z",
      tags: ["WTI", "XLE", "Commodities"],
      excerpt: "Higher oil can pressure inflation expectations and transport margins.",
      contentHtml:
        "Oil and energy equities are firmer as traders monitor global crude supply headlines and possible impacts on inflation expectations.",
      sourceUrl: "https://unusualwhales.com/news/energy-complex-firms-on-crude-supply-headlines"
    },
    {
      slug: "large-cap-earnings-calendar-light",
      title: "Large-cap earnings calendar light ahead of next week's reports",
      publishedAt: "2026-06-05T11:50:00.000Z",
      createdAt: "2026-06-05T11:40:00.000Z",
      fetchedAt: "2026-06-05T11:55:00.000Z",
      tags: ["SPY", "Earnings"],
      excerpt: "Index moves may be more macro-driven without a heavy earnings slate.",
      contentHtml:
        "The large-cap earnings calendar is light today, leaving index direction more exposed to macro data, rates, and sector rotation.",
      sourceUrl: "https://unusualwhales.com/news/large-cap-earnings-calendar-light"
    }
  ],
  unusualWhalesEarnings: [],
  earnings: [
    {
      ticker: "ABM",
      company: "ABM Industries",
      time: "BMO",
      expectedEps: "$0.86",
      expectedRevenue: "$2.08B",
      actualEps: "—",
      actualRevenue: "—",
      marketCap: "$3.1B"
    },
    {
      ticker: "DOCU",
      company: "DocuSign",
      time: "AMC",
      expectedEps: "$0.79",
      expectedRevenue: "$707M",
      actualEps: "—",
      actualRevenue: "—",
      marketCap: "$11.5B"
    }
  ],
  economicCalendar: [
    {
      time: "08:30 AM",
      event: "Nonfarm Payrolls",
      actual: "TBD",
      forecast: "185K",
      previous: "175K",
      importance: "High"
    },
    {
      time: "10:00 AM",
      event: "Wholesale Inventories",
      forecast: "0.1%",
      previous: "-0.4%",
      importance: "Medium"
    }
  ],
  sectorSnapshot: [
    { label: "XLK Technology", value: "+0.82%", tone: "positive" },
    { label: "XLC Communication Services", value: "+0.61%", tone: "positive" },
    { label: "XLU Utilities", value: "-0.31%", tone: "negative" },
    { label: "XLE Energy", value: "+0.44%", tone: "positive" }
  ],
  sourceMeta: [
    mockMeta("Unusual Whales Featured News", "https://unusualwhales.com/news"),
    mockMeta("FRED", "https://fred.stlouisfed.org/docs/api/fred/")
  ]
};

const tiles = (items: Array<[string, string, number, number]>) =>
  items.map(([symbol, label, changePercent, weight]) => ({
    symbol,
    label,
    value: 100 + changePercent,
    changePercent,
    weight,
    iconPath: getHeatmapIconPath(symbol)
  }));

const withMetricIcon = (metric: (typeof todayMock.keyStats)[number]) => ({
  ...metric,
  iconPath: getMetricIconPath(metric.label)
});

const marketStrip = () =>
  [
    todayMock.keyStats[0],
    todayMock.keyStats[1],
    todayMock.keyStats[6],
    todayMock.keyStats[7],
    todayMock.keyStats[8]
  ].map(withMetricIcon);

export const marketsMock = (): MarketsPayload => ({
  strip: marketStrip(),
  heatmaps: {
    globalMarkets: tiles([
      ["SPY", "U.S. Market", 0.34, 20],
      ["EWC", "Canadian Market", 0.18, 10],
      ["IEUR", "European Market", -0.18, 14],
      ["EWJ", "Japan Market", 0.22, 12],
      ["EWT", "Taiwan Market", 0.41, 10],
      ["EWH", "Hong Kong Market", -0.24, 8],
      ["EWY", "Korean Market", 0.09, 8],
      ["INDA", "Indian Market", 0.28, 10]
    ]),
    sectors: tiles([
      ["XLK", "Technology", 0.82, 18],
      ["XLF", "Financials", 0.12, 13],
      ["XLC", "Communication Services", 0.61, 10],
      ["XLY", "Consumer Discretionary", 0.31, 11],
      ["XLI", "Industrials", 0.08, 10],
      ["XLV", "Healthcare", -0.21, 12],
      ["XLP", "Consumer Staples", -0.12, 8],
      ["XLU", "Utilities", -0.31, 8],
      ["XLB", "Materials", 0.17, 8],
      ["XLE", "Energy", 0.44, 10],
      ["XLRE", "Real Estate", -0.26, 7],
      ["SMH", "Semiconductors", 1.18, 12]
    ]),
    crypto: tiles([
      ["BTCUSD", "Bitcoin", 1.05, 28],
      ["ETHUSD", "Ethereum", 0.72, 22],
      ["SOLUSD", "Solana", 2.1, 12],
      ["XRPUSD", "XRP", -0.4, 8],
      ["BNBUSD", "BNB", 0.34, 8],
      ["TRXUSD", "TRON", 0.22, 6],
      ["ADAUSD", "Cardano", -0.16, 6],
      ["DOGEUSD", "Dogecoin", -1.2, 6]
    ]),
    macro: tiles([
      ["GLD", "Gold", 0.22, 12],
      ["SLV", "Silver", -0.36, 8],
      ["USO", "Crude Oil", 0.54, 10],
      ["UNG", "Natural Gas", -0.64, 8],
      ["SHY", "Short-Term Bonds", 0.03, 10],
      ["TLT", "Long-Term Bonds", -0.18, 12],
      ["HYG", "High-Risk Corporate Bonds", -0.03, 10],
      ["UUP", "Dollar Index", 0.14, 10]
    ])
  },
  heatmapKeyMessages: getFinnhubKeyStatus()
    .filter((result) => !result.ok)
    .map((result) => result.message),
  breadth: [
    { label: "Participation", value: "Neutral", tone: "neutral" },
    { label: "Advancers / Decliners", value: "276 / 224", tone: "positive" },
    { label: "% above 50D MA", value: "54%", tone: "neutral" },
    { label: "New highs / lows", value: "42 / 19", tone: "positive" }
  ],
  movers: [
    { label: "Leader", value: "NVDA +2.4%", tone: "positive" },
    { label: "Laggard", value: "XLU -0.3%", tone: "negative" },
    { label: "Cross-asset watch", value: "WTI +0.5%", tone: "warning" }
  ],
  sourceMeta: [
    mockMeta("Finnhub heatmap routes", "https://finnhub.io/docs/api"),
    mockMeta("CoinGecko crypto source", "https://docs.coingecko.com/")
  ]
});

export const flowMock: FlowPayload = {
  summary: [
    {
      label: "Insider sentiment",
      value: "—",
      subtext: "Neutral",
      href: "/flow/insider-trades",
      tone: "neutral",
      ratio: null,
      purchaseValue: 0,
      saleValue: 0
    },
    { label: "Largest Dark Pool Print (14D)", value: "SPY", subtext: "0.3% of 30D Vol", change: "$84.2M", href: "/flow/dark-pool/SPY", tone: "neutral" },
    {
      label: "Whale Feed (7D)",
      value: "TSLA",
      subtext: "Bullish",
      change: "$12.4M",
      href: "/flow/whale-feed/TSLA",
      tone: "positive"
    }
  ],
  darkPool: [
    {
      externalId: "mock-spy-2026-06-04",
      executedAt: "2026-06-04T13:42:00.000Z",
      ticker: "SPY",
      sector: "ETF",
      price: 533.12,
      premium: 84200000,
      size: 158000,
      volume: 3000000,
      avg30Volume: 60000000,
      fetchedAt: "2026-06-04T14:00:00.000Z"
    }
  ],
  whaleTrades: [
    {
      externalId: "mock-tsla-whale-feed-2026-06-04",
      executedAt: "2026-06-04T14:04:00.000Z",
      ticker: "TSLA",
      sector: "Consumer Cyclical",
      price: 210.5,
      nbboAsk: 210.6,
      nbboBid: 210.1,
      side: "ask",
      sentiment: "bullish",
      premium: 12400000,
      size: 60000,
      volume: 1150000,
      avg30Volume: 82000000,
      fetchedAt: "2026-06-04T14:05:00.000Z"
    }
  ],
  insiderTrades: [
    {
      ticker: "CRM",
      sector: "Technology",
      tradeCount: 3,
      netShares: 25000,
      netValue: 450000,
      purchaseCount: 3,
      saleCount: 0,
      averageTradePrice: 18
    }
  ],
  sourceMeta: [
    mockMeta("Unusual Whales dark pool cache", "https://phx.unusualwhales.com/api/flow/dark-pool"),
    mockMeta(
      "Unusual Whales insider trades cache",
      "https://phx.unusualwhales.com/api/insider_trades/feed"
    ),
    mockMeta("Whale Feed fixture fallback")
  ],
  notices: ["Whale Feed falls back to fixtures when Supabase data is unavailable."]
};

export const ownershipMock: OwnershipPayload = {
  congressionalTrades: [
    {
      Published: "2026-06-03",
      Traded: "2026-05-20",
      Politician: "Member",
      Ticker: "MSFT",
      Side: "Buy",
      Amount: "$15K-$50K",
      FiledAfter: "14 days"
    }
  ],
  institutionalPositioning: [
    {
      Fund: "Example Capital",
      Ticker: "MSFT",
      Shares: "1.2M",
      MarketValue: "$512M",
      Weight: "4.8%",
      QoQ: "+18%",
      ReportPeriod: "2026 Q1",
      Filed: "2026-05-15"
    }
  ],
  sourceMeta: [
    mockMeta(
      "Capitol Trades fixture placeholder",
      "https://www.capitoltrades.com/trades?pageSize=96"
    )
  ],
  notices: []
};

export const economyMock: { sentiment: Metric[]; sourceMeta: ReturnType<typeof mockMeta>[] } = {
  sentiment: [
    { label: "CBOE total put/call", value: "0.91", tone: "neutral" },
    { label: "AAII bullish", value: "39.1%", tone: "neutral" },
    { label: "AAII bearish", value: "31.8%", tone: "warning" }
  ],
  sourceMeta: [
    mockMeta("CBOE Market Statistics", "https://www.cboe.com/data/mktstat.aspx?dt=2026-06-04"),
    mockMeta("AAII Sentiment", "https://www.aaii.com/sentimentsurvey/sent_results")
  ]
};

export const tickerMock = (symbol: string): TickerPayload => ({
  symbol,
  header: [
    {
      label: symbol,
      value: "$212.44",
      change: "+$2.18",
      changePercent: "+1.04%",
      tone: "positive"
    },
    { label: "Sector", value: "Technology", tone: "neutral" },
    { label: "Market cap", value: "$3.2T", tone: "neutral" }
  ],
  story: `${symbol} is trading higher in this mock snapshot with constructive index tape, partial flow coverage, and no live source calls. Configure required Netlify variables and scheduled ingestion to enable live ticker intelligence.`,
  timeline: todayMock.featuredNews.map((article) => ({
    headline: article.title,
    timestamp: article.publishedAt ?? article.createdAt ?? article.fetchedAt,
    tickers: article.tags,
    whyItMatters: article.excerpt ?? "Featured market article.",
    source: "Unusual Whales",
    sourceUrl: article.sourceUrl,
    category: "Market",
    impact: "Medium"
  })),
  flow: flowMock.summary,
  ownership: [
    { label: "Latest 13F posture", value: "Accumulation", tone: "positive" },
    { label: "Insider activity", value: "No recent buys", tone: "neutral" }
  ],
  sectorContext: todayMock.sectorSnapshot,
  sourceMeta: [mockMeta("Ticker mock snapshot")]
});
