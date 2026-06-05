import type { FreshnessStatus } from "@/lib/data/schemas/common";

export type CommoditySymbol = "WTI" | "BRENT" | "GOLD" | "SILVER";

export type CommodityProvider = "finnhub" | "twelve-data" | "fred" | "other-market-data-provider";

export type CommodityQuotePlan = {
  symbol: CommoditySymbol;
  preferredProviders: CommodityProvider[];
  status: FreshnessStatus;
  note: string;
};

export const commodityQuotePlans: CommodityQuotePlan[] = [
  {
    symbol: "WTI",
    preferredProviders: ["finnhub", "twelve-data", "fred", "other-market-data-provider"],
    status: "delayed",
    note: "WTI crude oil prices should use Finnhub, Twelve Data, FRED where appropriate, or another available market data provider."
  },
  {
    symbol: "BRENT",
    preferredProviders: ["finnhub", "twelve-data", "fred", "other-market-data-provider"],
    status: "delayed",
    note: "Brent crude oil prices should use Finnhub, Twelve Data, FRED where appropriate, or another available market data provider."
  },
  {
    symbol: "GOLD",
    preferredProviders: ["finnhub", "twelve-data", "other-market-data-provider"],
    status: "delayed",
    note: "Gold quotes use market data providers; macro context can be paired with FRED series."
  },
  {
    symbol: "SILVER",
    preferredProviders: ["finnhub", "twelve-data", "other-market-data-provider"],
    status: "delayed",
    note: "Silver quotes use market data providers; macro context can be paired with FRED series."
  }
];
