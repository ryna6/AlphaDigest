import type { EconomyPayload, FlowPayload, MarketsPayload, TickerPayload, TodayPayload } from "../schemas/dashboard";
import { getFinnhubKeyStatus } from "../adapters/finnhub-key-router";

const now = "2026-06-05T13:30:00-04:00";
const mockMeta = (source: string, sourceUrl?: string) => ({
  source,
  sourceUrl,
  lastUpdated: now,
  mode: "mock" as const,
  message: "Mock data enabled. Configure required Netlify environment variables and ingestion jobs to enable live data."
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
    { label: "Leading sectors", value: "Tech, Comm Services, Energy", change: "+0.82% / +0.61% / +0.44%", tone: "positive" },
    { label: "Risk-on / risk-off", value: "1.22", change: "RoRo ratio > 1 = risk off; < 1 = risk on", tone: "neutral" },
    { label: "Today’s earnings", value: "2 earnings", change: "ABM, DOCU", tone: "neutral" },
    { label: "Put/call ratio", value: "0.91", change: "Neutral", tone: "neutral" }
  ],
  keyStats: [
    { label: "S&P 500", value: "5,352.96", change: "+18.12", changePercent: "+0.34%", tone: "positive" },
    { label: "Nasdaq 100", value: "17,098.45", change: "+91.43", changePercent: "+0.54%", tone: "positive" },
    { label: "WTI Oil", value: "$78.28", change: "+$0.42", changePercent: "+0.54%", tone: "warning" },
    { label: "Gold", value: "$2,336.20", change: "+$5.10", changePercent: "+0.22%", tone: "neutral" },
    { label: "Bitcoin", value: "$68,420", change: "+$710", changePercent: "+1.05%", tone: "positive" },
    { label: "VIX", value: "13.42", change: "-0.38", changePercent: "-2.75%", tone: "positive" },
    { label: "Mid Cap", value: "60.42", change: "+0.18", changePercent: "+0.30%", tone: "positive" },
    { label: "Small Cap", value: "202.16", change: "-0.54", changePercent: "-0.27%", tone: "negative" }
  ],
  featuredNews: [
    { headline: "Mega-cap technology leads premarket tape as yields edge higher", timestamp: "08:42 ET", tickers: ["QQQ", "XLK"], whyItMatters: "Leadership remains narrow, keeping breadth confirmation important.", category: "Macro", impact: "Medium" },
    { headline: "Energy complex firms as traders watch crude supply headlines", timestamp: "08:12 ET", tickers: ["WTI", "XLE"], whyItMatters: "Higher oil can pressure inflation expectations and transport margins.", category: "Commodities", impact: "Medium" },
    { headline: "Large-cap earnings calendar light ahead of next week's reports", timestamp: "07:50 ET", tickers: ["SPY"], whyItMatters: "Index moves may be more macro-driven without a heavy earnings slate.", category: "Earnings", impact: "Low" }
  ],
  earnings: [
    { ticker: "ABM", company: "ABM Industries", time: "BMO", expectedEps: "$0.86", expectedRevenue: "$2.08B", marketCap: "$3.1B" },
    { ticker: "DOCU", company: "DocuSign", time: "AMC", expectedEps: "$0.79", expectedRevenue: "$707M", marketCap: "$11.5B" }
  ],
  economicCalendar: [
    { time: "08:30 ET", event: "Nonfarm Payrolls", actual: "TBD", forecast: "185K", previous: "175K", importance: "High" },
    { time: "10:00 ET", event: "Wholesale Inventories", forecast: "0.1%", previous: "-0.4%", importance: "Medium" }
  ],
  sectorSnapshot: [
    { label: "XLK Technology", value: "+0.82%", tone: "positive" },
    { label: "XLC Communication Services", value: "+0.61%", tone: "positive" },
    { label: "XLU Utilities", value: "-0.31%", tone: "negative" },
    { label: "XLE Energy", value: "+0.44%", tone: "positive" }
  ],
  sourceMeta: [mockMeta("Unusual Whales Featured News", "https://unusualwhales.com/news"), mockMeta("FRED", "https://fred.stlouisfed.org/docs/api/fred/")]
};

const tiles = (items: Array<[string, string, number, number]>) =>
  items.map(([symbol, label, changePercent, weight]) => ({
    symbol,
    label,
    value: 100 + changePercent,
    changePercent,
    weight
  }));

const marketStrip = () => [
  todayMock.keyStats[0],
  todayMock.keyStats[1],
  todayMock.keyStats[6],
  todayMock.keyStats[7],
  todayMock.keyStats[2],
  todayMock.keyStats[3],
  todayMock.keyStats[4],
  todayMock.keyStats[5]
];

export const marketsMock = (): MarketsPayload => ({
  strip: marketStrip(),
  heatmaps: {
    globalMarkets: tiles([
      ["SPY", "U.S. Market", 0.34, 20], ["EWC", "Canadian Market", 0.18, 10], ["IEUR", "European Market", -0.18, 14], ["EWJ", "Japan Market", 0.22, 12], ["EWT", "Taiwan Market", 0.41, 10], ["EWH", "Hong Kong Market", -0.24, 8], ["EWY", "Korean Market", 0.09, 8], ["INDA", "Indian Market", 0.28, 10]
    ]),
    sectors: tiles([
      ["XLK", "Technology", 0.82, 18], ["XLF", "Financials", 0.12, 13], ["XLC", "Communication Services", 0.61, 10], ["XLY", "Consumer Discretionary", 0.31, 11], ["XLI", "Industrials", 0.08, 10], ["XLV", "Healthcare", -0.21, 12], ["XLP", "Consumer Staples", -0.12, 8], ["XLU", "Utilities", -0.31, 8], ["XLB", "Materials", 0.17, 8], ["XLE", "Energy", 0.44, 10], ["XLRE", "Real Estate", -0.26, 7], ["SMH", "Semiconductors", 1.18, 12]
    ]),
    crypto: tiles([
      ["BTCUSD", "Bitcoin", 1.05, 28], ["ETHUSD", "Ethereum", 0.72, 22], ["SOLUSD", "Solana", 2.1, 12], ["XRPUSD", "XRP", -0.4, 8], ["BNBUSD", "BNB", 0.34, 8], ["TRXUSD", "TRON", 0.22, 6], ["ADAUSD", "Cardano", -0.16, 6], ["DOGEUSD", "Dogecoin", -1.2, 6]
    ]),
    macro: tiles([
      ["GLD", "Gold", 0.22, 12], ["SLV", "Silver", -0.36, 8], ["USO", "Crude Oil", 0.54, 10], ["UNG", "Natural Gas", -0.64, 8], ["SHY", "Short-Term Bonds", 0.03, 10], ["TLT", "Long-Term Bonds", -0.18, 12], ["HYG", "High-Risk Corporate Bonds", -0.03, 10], ["UUP", "Dollar Index", 0.14, 10]
    ])
  },
  heatmapKeyMessages: getFinnhubKeyStatus().filter((result) => !result.ok).map((result) => result.message),
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
  sourceMeta: [mockMeta("Finnhub heatmap routes", "https://finnhub.io/docs/api"), mockMeta("CoinGecko crypto source", "https://docs.coingecko.com/")]
});

export const flowMock: FlowPayload = {
  summary: [
    { label: "Most active ticker", value: "NVDA", change: "7D", tone: "positive" },
    { label: "Largest dark pool print", value: "$84.2M SPY", tone: "neutral" },
    { label: "Highest whale premium", value: "$12.4M TSLA calls", tone: "positive" },
    { label: "Top 13F accumulation", value: "MSFT", tone: "positive" }
  ],
  darkPool: [{ Time: "09:42 ET", Ticker: "SPY", Price: "$533.12", Size: "158K", Notional: "$84.2M", Venue: "TRF" }],
  whaleTrades: [{ Time: "10:04 ET", Ticker: "TSLA", Type: "Call sweep", Premium: "$12.4M", Bias: "Bullish", Expiry: "2026-07-17", Strike: "$210" }],
  insiderTrades: [{ Date: "2026-06-04", Ticker: "CRM", Insider: "Jane Doe", Role: "Director", Side: "Buy", Value: "$450K", Type: "Open market" }],
  congressionalTrades: [{ Published: "2026-06-03", Traded: "2026-05-20", Politician: "Member", Ticker: "MSFT", Side: "Buy", Amount: "$15K-$50K", FiledAfter: "14 days" }],
  institutionalPositioning: [{ Fund: "Example Capital", Ticker: "MSFT", Shares: "1.2M", MarketValue: "$512M", Weight: "4.8%", QoQ: "+18%", ReportPeriod: "2026 Q1", Filed: "2026-05-15" }],
  sourceMeta: [mockMeta("Unusual Whales flow sources"), mockMeta("Capitol Trades", "https://www.capitoltrades.com/trades?pageSize=96"), mockMeta("sec-api.io 13F", "https://sec-api.io/docs/form-13-f-filings-institutional-holdings-api")]
};

export const economyMock: EconomyPayload = {
  regimeBadges: [
    { label: "Macro Backdrop", value: "Neutral", tone: "neutral" }, { label: "Rates", value: "Restrictive", tone: "warning" }, { label: "Inflation", value: "Cooling", tone: "positive" }, { label: "Labor", value: "Softening", tone: "warning" }, { label: "Credit", value: "Stable", tone: "positive" }, { label: "Oil", value: "Rising", tone: "warning" }
  ],
  rates: [{ label: "Fed policy rate", value: "5.25–5.50%", tone: "warning" }, { label: "2Y yield", value: "4.71%", change: "+3 bps", tone: "warning" }, { label: "10Y yield", value: "4.29%", change: "+2 bps", tone: "warning" }, { label: "10Y–2Y", value: "-42 bps", tone: "warning" }],
  inflation: [{ label: "CPI YoY", value: "3.4%", tone: "warning" }, { label: "Core CPI YoY", value: "3.6%", tone: "warning" }, { label: "PPI YoY", value: "2.2%", tone: "neutral" }],
  labor: [{ label: "Unemployment", value: "3.9%", tone: "neutral" }, { label: "Initial claims", value: "229K", tone: "warning" }, { label: "Continuing claims", value: "1.79M", tone: "warning" }],
  sentiment: [{ label: "CBOE total put/call", value: "0.91", tone: "neutral" }, { label: "AAII bullish", value: "39.1%", tone: "neutral" }, { label: "AAII bearish", value: "31.8%", tone: "warning" }],
  oilRisk: [{ label: "WTI crude", value: "$78.28", changePercent: "+0.54%", tone: "warning" }, { label: "Brent crude", value: "$82.44", changePercent: "+0.49%", tone: "warning" }, { label: "Hormuz status", value: "Optional / disabled", tone: "neutral" }],
  liquidity: [{ label: "Reverse repo", value: "$412B", tone: "neutral" }, { label: "SOFR", value: "5.32%", tone: "warning" }, { label: "Fed balance sheet", value: "$7.3T", tone: "neutral" }],
  sourceMeta: [mockMeta("FRED", "https://fred.stlouisfed.org/docs/api/fred/"), mockMeta("CBOE Market Statistics", "https://www.cboe.com/data/mktstat.aspx?dt=2026-06-04"), mockMeta("AAII Sentiment", "https://www.aaii.com/sentimentsurvey/sent_results")]
};

export const tickerMock = (symbol: string): TickerPayload => ({
  symbol,
  header: [{ label: symbol, value: "$212.44", change: "+$2.18", changePercent: "+1.04%", tone: "positive" }, { label: "Sector", value: "Technology", tone: "neutral" }, { label: "Market cap", value: "$3.2T", tone: "neutral" }],
  story: `${symbol} is trading higher in this mock snapshot with constructive index tape, partial flow coverage, and no live source calls. Configure required Netlify variables and scheduled ingestion to enable live ticker intelligence.`,
  timeline: todayMock.featuredNews,
  flow: flowMock.summary,
  ownership: [{ label: "Latest 13F posture", value: "Accumulation", tone: "positive" }, { label: "Insider activity", value: "No recent buys", tone: "neutral" }],
  sectorContext: todayMock.sectorSnapshot,
  sourceMeta: [mockMeta("Ticker mock snapshot")]
});
