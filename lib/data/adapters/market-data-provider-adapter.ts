import type { FreshnessStatus } from "../schemas/common";

export type ProviderCapability = "quote" | "ohlc" | "macro" | "crypto" | "commodity" | "breadth";

export type MarketDataProvider = {
  name: string;
  capabilities: ProviderCapability[];
  envVar?: string;
  status: FreshnessStatus;
  notes: string;
};

export const marketDataProviders: MarketDataProvider[] = [
  { name: "Finnhub", capabilities: ["quote", "commodity", "breadth"], status: "unavailable", notes: "Uses heatmap-specific keys by feature area." },
  { name: "Twelve Data", capabilities: ["quote", "ohlc", "commodity"], envVar: "TWELVE_DATA_API_KEY", status: "unavailable", notes: "Preferred for OHLC candles and oil historical charts when available." },
  { name: "CoinGecko", capabilities: ["crypto"], envVar: "COINGECKO_API_KEY", status: "unavailable", notes: "Primary crypto heatmap provider." },
  { name: "FRED", capabilities: ["macro", "commodity"], envVar: "FRED_API_KEY", status: "unavailable", notes: "Macro observations, rates, spreads, and oil macro context where appropriate." }
];
