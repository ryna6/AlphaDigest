import type { SourceMeta } from "../schemas/common";

export type CommoditySymbol = "WTI" | "BRENT" | "GOLD" | "SILVER";

export type CommodityQuote = {
  symbol: CommoditySymbol;
  label: string;
  value: string;
  change: string;
  changePercent: string;
  providerPreference: string[];
  sourceMeta: SourceMeta;
};

export function describeCommodityProviderStrategy(symbol: CommoditySymbol): string {
  const common = "Finnhub, Twelve Data, FRED where appropriate, or another available market data provider";
  if (symbol === "WTI") return `WTI crude oil: ${common}. Oil historical charts prefer Twelve Data if available; oil macro context can use FRED.`;
  if (symbol === "BRENT") return `Brent crude oil: ${common}. Oil historical charts prefer Twelve Data if available; oil macro context can use FRED.`;
  return `${symbol}: Finnhub / Twelve Data / available market data provider.`;
}

export function getMockCommodityQuote(symbol: CommoditySymbol): CommodityQuote {
  const labels: Record<CommoditySymbol, string> = {
    WTI: "WTI crude oil",
    BRENT: "Brent crude oil",
    GOLD: "Gold",
    SILVER: "Silver"
  };

  return {
    symbol,
    label: labels[symbol],
    value: symbol === "GOLD" ? "$2,336.20" : symbol === "SILVER" ? "$30.12" : symbol === "BRENT" ? "$82.44" : "$78.28",
    change: symbol === "SILVER" ? "-$0.11" : "+$0.42",
    changePercent: symbol === "SILVER" ? "-0.36%" : "+0.54%",
    providerPreference: ["Finnhub", "Twelve Data", "FRED where appropriate", "available market data provider"],
    sourceMeta: {
      source: "Mock commodity adapter",
      lastUpdated: new Date().toISOString(),
      status: "degraded",
      mode: "mock",
      message: describeCommodityProviderStrategy(symbol)
    }
  };
}
