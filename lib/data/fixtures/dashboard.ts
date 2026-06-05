import type { HeatmapTile, Metric, SourceMeta, TableColumn, TableRow } from "@/lib/types";

export const mockMeta: SourceMeta = {
  source: "MVP fixture layer",
  lastUpdated: "2026-06-05T13:30:00-04:00",
  status: "degraded",
  mode: "mock",
  message: "Mock data enabled. Add API keys in Netlify to enable live data.",
};

export const keyMarketStats: Metric[] = [
  { label: "S&P 500", value: "6,185.42", change: "+18.20", changePercent: "+0.30%", direction: "up", source: "Finnhub / Twelve Data" },
  { label: "Nasdaq", value: "20,141.08", change: "+74.11", changePercent: "+0.37%", direction: "up", source: "Finnhub / Twelve Data" },
  { label: "VIX", value: "14.82", change: "-0.41", changePercent: "-2.69%", direction: "down", source: "Finnhub / Twelve Data" },
  { label: "WTI crude oil", value: "$74.10", change: "+0.62", changePercent: "+0.84%", direction: "up", source: "Finnhub / Twelve Data / FRED" },
  { label: "Gold", value: "$2,382", change: "+8.40", changePercent: "+0.35%", direction: "up", source: "Finnhub / Twelve Data" },
  { label: "Bitcoin", value: "$71,420", change: "+940", changePercent: "+1.33%", direction: "up", source: "CoinGecko" },
  { label: "U.S. 10Y", value: "4.21%", change: "-0.03", changePercent: "", direction: "down", source: "FRED / market quote provider" },
];

export const topNews: TableRow[] = [
  { time: "08:42 ET", headline: "Mega-cap tech leads premarket bid as yields ease", tickers: "SPY, QQQ", impact: "High" },
  { time: "09:05 ET", headline: "Energy shares firm with crude oil higher", tickers: "XLE, WTI", impact: "Medium" },
  { time: "09:18 ET", headline: "Fed speakers expected to frame June rate path", tickers: "TLT, DXY", impact: "High" },
  { time: "10:12 ET", headline: "Bitcoin rebounds as risk appetite improves", tickers: "BTC", impact: "Medium" },
  { time: "11:30 ET", headline: "Breadth improves but small caps lag leaders", tickers: "IWM", impact: "Medium" },
];

export const earningsRows: TableRow[] = [
  { ticker: "ADBE", company: "Adobe", time: "AMC", eps: "$4.55", revenue: "$5.41B" },
  { ticker: "KR", company: "Kroger", time: "BMO", eps: "$1.29", revenue: "$45.1B" },
  { ticker: "LEN", company: "Lennar", time: "AMC", eps: "$3.18", revenue: "$8.7B" },
];

export const economicRows: TableRow[] = [
  { time: "08:30 ET", event: "Initial jobless claims", actual: "236K", forecast: "240K", previous: "239K", importance: "High" },
  { time: "10:00 ET", event: "Consumer sentiment", actual: "--", forecast: "72.1", previous: "71.8", importance: "Medium" },
];

export const globalHeatmap: HeatmapTile[] = [
  { label: "S&P 500", ticker: "SPX", value: "6,185", changePercent: 0.3, weight: 15, source: "Finnhub Global", lastUpdated: "09:30 ET" },
  { label: "Nasdaq", ticker: "NDX", value: "20,141", changePercent: 0.37, weight: 14, source: "Finnhub Global", lastUpdated: "09:30 ET" },
  { label: "Dow", ticker: "DJI", value: "42,400", changePercent: 0.12, weight: 10, source: "Finnhub Global", lastUpdated: "09:30 ET" },
  { label: "Russell", ticker: "RUT", value: "2,124", changePercent: -0.18, weight: 8, source: "Finnhub Global", lastUpdated: "09:30 ET" },
  { label: "Gold", ticker: "XAU", value: "2,382", changePercent: 0.35, weight: 7, source: "Twelve Data", lastUpdated: "09:30 ET" },
  { label: "Oil", ticker: "WTI", value: "74.10", changePercent: 0.84, weight: 7, source: "Finnhub / Twelve Data", lastUpdated: "09:30 ET" },
  { label: "Bitcoin", ticker: "BTC", value: "71,420", changePercent: 1.33, weight: 9, source: "CoinGecko", lastUpdated: "09:30 ET" },
];

export const sectorHeatmap: HeatmapTile[] = ["XLK Technology", "XLF Financials", "XLE Energy", "XLV Healthcare", "XLY Discretionary", "XLP Staples", "XLI Industrials", "XLU Utilities", "XLB Materials", "XLRE Real Estate", "XLC Communications"].map((label, index) => ({
  label,
  ticker: label.split(" ")[0],
  value: index % 3 === 0 ? "Leader" : "Mixed",
  changePercent: [0.9, 0.2, 1.1, -0.3, 0.4, -0.1, 0.2, -0.5, 0.1, -0.2, 0.7][index],
  weight: 6 + (index % 4),
  source: "Finnhub Sectors",
  lastUpdated: "09:30 ET",
}));

export const cryptoHeatmap: HeatmapTile[] = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "TON"].map((ticker, index) => ({
  label: ticker,
  ticker,
  value: "Crypto",
  changePercent: [1.3, 0.8, 2.4, -0.2, 0.1, 1.1, -0.5, 0.7, 0.4, -0.1][index],
  weight: 5 + (index % 5),
  source: "CoinGecko primary",
  lastUpdated: "09:30 ET",
}));

export const macroHeatmap: HeatmapTile[] = ["Gold", "Silver", "WTI", "Brent", "2Y", "10Y", "10Y-2Y", "DXY", "BTC", "VIX", "HY Spread", "IG Spread"].map((label, index) => ({
  label,
  ticker: label.toUpperCase(),
  value: "Macro",
  changePercent: [0.35, 0.25, 0.84, 0.77, -0.08, -0.03, 0.02, -0.15, 1.33, -2.69, 0.01, 0.0][index],
  weight: 5 + (index % 3),
  source: label.includes("Spread") || label.includes("Y") ? "FRED" : "Finnhub / Twelve Data / CoinGecko",
  lastUpdated: "09:30 ET",
}));

export const compactColumns: TableColumn[] = [
  { key: "ticker", label: "Ticker" },
  { key: "company", label: "Company" },
  { key: "time", label: "Time" },
  { key: "eps", label: "EPS", align: "right" },
  { key: "revenue", label: "Revenue", align: "right" },
];

export const flowRows: TableRow[] = [
  { time: "09:41 ET", ticker: "NVDA", price: "$128.40", size: "1.2M", premium: "$154M", venue: "Off-exchange" },
  { time: "10:05 ET", ticker: "TSLA", price: "$182.10", size: "420K", premium: "$76M", venue: "ATS" },
  { time: "10:44 ET", ticker: "AAPL", price: "$211.08", size: "310K", premium: "$65M", venue: "Off-exchange" },
];
