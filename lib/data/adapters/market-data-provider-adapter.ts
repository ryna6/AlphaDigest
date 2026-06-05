import type { FreshnessStatus } from "@/lib/types";

export type MarketDataProvider = "finnhub" | "twelve-data" | "fred" | "coingecko" | "mock";

export type ProviderAvailability = {
  provider: MarketDataProvider;
  available: boolean;
  status: FreshnessStatus;
  message: string;
};

export function getProviderAvailability(): ProviderAvailability[] {
  return [
    {
      provider: "finnhub",
      available: Boolean(
        process.env.FINNHUB_GLOBAL_MARKETS_API_KEY || process.env.FINNHUB_MACRO_HEATMAP_API_KEY,
      ),
      status:
        process.env.FINNHUB_GLOBAL_MARKETS_API_KEY || process.env.FINNHUB_MACRO_HEATMAP_API_KEY
          ? "fresh"
          : "unavailable",
      message: "Finnhub supports quotes and cross-asset market data where available.",
    },
    {
      provider: "twelve-data",
      available: Boolean(process.env.TWELVE_DATA_API_KEY),
      status: process.env.TWELVE_DATA_API_KEY ? "fresh" : "unavailable",
      message: "Twelve Data is preferred for OHLC candles and historical commodity charts.",
    },
    {
      provider: "fred",
      available: Boolean(process.env.FRED_API_KEY),
      status: process.env.FRED_API_KEY ? "fresh" : "unavailable",
      message: "FRED is preferred for macro context, yields, spreads, and official time series.",
    },
    {
      provider: "coingecko",
      available: Boolean(process.env.COINGECKO_API_KEY),
      status: process.env.COINGECKO_API_KEY ? "fresh" : "delayed",
      message: "CoinGecko is the primary crypto market data source.",
    },
  ];
}
