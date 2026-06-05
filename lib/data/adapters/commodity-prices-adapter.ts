import { getProviderAvailability } from "./market-data-provider-adapter";

export type CommoditySymbol = "WTI" | "BRENT" | "GOLD" | "SILVER";

export function describeCommodityProvider(symbol: CommoditySymbol) {
  const providers = getProviderAvailability();
  const liveProvider = providers.find((provider) => provider.available);

  return {
    symbol,
    preferredProviders:
      symbol === "WTI" || symbol === "BRENT"
        ? ["Finnhub", "Twelve Data", "FRED macro context", "available market data provider"]
        : ["Finnhub", "Twelve Data", "available market data provider"],
    selectedProvider: liveProvider?.provider ?? "mock",
    status: liveProvider?.status ?? "degraded",
    message: liveProvider
      ? `${symbol} can be resolved server-side through ${liveProvider.provider}.`
      : `${symbol} is using mock data. Add Finnhub, Twelve Data, or FRED keys in Netlify environment variables for live data.`,
  };
}
