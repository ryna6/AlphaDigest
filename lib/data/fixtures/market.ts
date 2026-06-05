import type { HeatmapTile, Metric, SourceMeta } from "@/lib/data/schemas/common";

export const mockTimestamp = "2026-06-05T13:35:00-04:00";

export const mockSourceMeta: SourceMeta = {
  source: "MVP mock fixture",
  lastUpdated: mockTimestamp,
  status: "delayed",
  mode: "mock",
  message: "Mock data enabled. Add API keys in Netlify to enable live data."
};

export const keyMarketStats: Metric[] = [
  { label: "S&P 500", value: "6,142.30", change: "+18.44", changePercent: "+0.30%", status: "delayed" },
  { label: "Nasdaq", value: "20,071.18", change: "+92.10", changePercent: "+0.46%", status: "delayed" },
  { label: "VIX", value: "14.82", change: "-0.41", changePercent: "-2.69%", status: "delayed" },
  { label: "WTI crude oil", value: "$73.18", change: "+$0.54", changePercent: "+0.74%", status: "delayed" },
  { label: "Gold", value: "$3,372.60", change: "-$8.20", changePercent: "-0.24%", status: "delayed" },
  { label: "Bitcoin", value: "$104,240", change: "+$820", changePercent: "+0.79%", status: "delayed" },
  { label: "U.S. 10-year yield", value: "4.31%", change: "+3 bp", changePercent: "+0.03", status: "delayed" }
];

export const marketStrip: Metric[] = [
  { label: "SPY", value: "612.45", changePercent: "+0.31%" },
  { label: "QQQ", value: "522.18", changePercent: "+0.48%" },
  { label: "IWM", value: "219.40", changePercent: "-0.12%" },
  { label: "DIA", value: "445.06", changePercent: "+0.08%" },
  { label: "VIX", value: "14.82", changePercent: "-2.69%" },
  { label: "BTC", value: "104.2K", changePercent: "+0.79%" },
  { label: "WTI", value: "73.18", changePercent: "+0.74%" },
  { label: "Gold", value: "3372.6", changePercent: "-0.24%" }
];

export const heatmapTiles: HeatmapTile[] = [
  { label: "Technology", symbol: "XLK", value: "$244.10", changePercent: 1.21, weight: 11, source: "Finnhub sectors key", lastUpdated: mockTimestamp },
  { label: "Financials", symbol: "XLF", value: "$48.32", changePercent: 0.44, weight: 8, source: "Finnhub sectors key", lastUpdated: mockTimestamp },
  { label: "Energy", symbol: "XLE", value: "$92.18", changePercent: -0.62, weight: 6, source: "Finnhub sectors key", lastUpdated: mockTimestamp },
  { label: "Healthcare", symbol: "XLV", value: "$146.91", changePercent: -0.18, weight: 7, source: "Finnhub sectors key", lastUpdated: mockTimestamp },
  { label: "Bitcoin", symbol: "BTC", value: "$104,240", changePercent: 0.79, weight: 8, source: "CoinGecko", lastUpdated: mockTimestamp },
  { label: "WTI Crude", symbol: "WTI", value: "$73.18", changePercent: 0.74, weight: 5, source: "Finnhub / Twelve Data / FRED", lastUpdated: mockTimestamp },
  { label: "Gold", symbol: "XAU", value: "$3,372.60", changePercent: -0.24, weight: 5, source: "Market data provider", lastUpdated: mockTimestamp },
  { label: "10Y Yield", symbol: "DGS10", value: "4.31%", changePercent: 0.03, weight: 4, source: "FRED", lastUpdated: mockTimestamp }
];

export const mockNews = [
  { headline: "Semiconductors lead as mega-cap growth stabilizes", time: "9:42 AM ET", tags: ["NVDA", "SMH"], why: "Leadership is concentrated in high-beta growth, keeping risk appetite constructive.", source: "Unusual Whales Featured News" },
  { headline: "Oil firms on supply-risk headlines", time: "9:25 AM ET", tags: ["WTI", "XLE"], why: "Energy strength can pressure inflation expectations and support sector rotation.", source: "Unusual Whales Featured News" },
  { headline: "Treasury yields edge higher before payroll revisions", time: "8:58 AM ET", tags: ["DGS10"], why: "Higher yields can tighten financial conditions for duration-sensitive equities.", source: "Unusual Whales Featured News" },
  { headline: "Crypto majors trade higher with improving liquidity tone", time: "8:31 AM ET", tags: ["BTC", "ETH"], why: "Crypto bid often confirms speculative risk appetite across assets.", source: "Unusual Whales Featured News" }
];
