import { cryptoAssets } from "./adapters/coingecko-crypto";

export type CandleAssetGroup = "indices" | "global" | "sectors" | "macro" | "today" | "sp500" | "crypto";
export type CandleAsset = { symbol: string; label: string; group: CandleAssetGroup; finnhubSymbol?: string; unusualWhalesSymbol?: string; chartAvailable: boolean; unavailableReason?: string };

export const marketCandleAssets: CandleAsset[] = [
  { symbol: "SPY", label: "S&P 500", group: "indices" as const, finnhubSymbol: "SPY", unusualWhalesSymbol: "SPY", chartAvailable: true },
  { symbol: "QQQ", label: "Nasdaq 100", group: "indices" as const, finnhubSymbol: "QQQ", unusualWhalesSymbol: "QQQ", chartAvailable: true },
  { symbol: "IJH", label: "Mid Cap", group: "indices" as const, finnhubSymbol: "IJH", unusualWhalesSymbol: "IJH", chartAvailable: true },
  { symbol: "IWM", label: "Small Cap", group: "indices" as const, finnhubSymbol: "IWM", unusualWhalesSymbol: "IWM", chartAvailable: true },
  { symbol: "ES=F", label: "S&P 500 Futures", group: "indices" as const, chartAvailable: false, unavailableReason: "Existing Yahoo futures symbol not confirmed for Finnhub/UW candle ingestion." },
  { symbol: "VIX", label: "VIX", group: "today" as const, finnhubSymbol: "^VIX", chartAvailable: false, unavailableReason: "Provider mapping not confirmed for daily candle ingestion." },
  ...["EWC","IEUR","EWJ","EWT","EWH","EWY","INDA","XLK","XLF","XLC","XLY","XLI","XLV","XLP","XLU","XLB","XLE","XLRE","SMH","GLD","SLV","USO","UNG","SHY","TLT","HYG","UUP"].map((symbol) => ({ symbol, label: symbol, group: symbol.startsWith("XL") || symbol === "SMH" ? "sectors" as const : ["GLD","SLV","USO","UNG","SHY","TLT","HYG","UUP"].includes(symbol) ? "macro" as const : "global" as const, finnhubSymbol: symbol, unusualWhalesSymbol: symbol, chartAvailable: true }))
].filter((asset, index, arr) => arr.findIndex((a) => a.symbol === asset.symbol) === index);

export const cryptoCandleAssets: CandleAsset[] = cryptoAssets.map((asset) => ({
  symbol: asset.symbol,
  label: asset.label,
  group: "crypto",
  unusualWhalesSymbol: asset.symbol.replace(/USD$/, "-USD"),
  chartAvailable: true
}));

export function normalizeAppSymbol(symbol: string) { return symbol.trim().toUpperCase().replace(/\./g, "-"); }
export function toFinnhubShareClassSymbol(symbol: string) { return normalizeAppSymbol(symbol).replace(/-/g, "."); }
export function toUnusualWhalesShareClassSymbol(symbol: string) { return normalizeAppSymbol(symbol).replace(/-/g, "."); }
export function resolveConfiguredCryptoCandleAsset(symbol: string) {
  const normalized = normalizeAppSymbol(symbol);
  const crypto = cryptoCandleAssets.find((a) => normalizeAppSymbol(a.symbol) === normalized && a.chartAvailable);
  return crypto ? { table: "crypto_daily_candles" as const, asset: crypto } : null;
}
export function resolveConfiguredFixedCandleAsset(symbol: string) {
  const normalized = normalizeAppSymbol(symbol);
  const market = marketCandleAssets.find((a) => normalizeAppSymbol(a.symbol) === normalized && a.chartAvailable);
  return market ? { table: "market_daily_candles" as const, asset: market } : null;
}
export function resolveSp500CandleAsset(symbol: string, sp500Symbols: string[] = []) {
  const normalized = normalizeAppSymbol(symbol);
  if (!sp500Symbols.map(normalizeAppSymbol).includes(normalized)) return null;
  return { table: "sp500_daily_candles" as const, asset: { symbol: normalized, label: normalized, group: "sp500" as const, finnhubSymbol: toFinnhubShareClassSymbol(normalized), unusualWhalesSymbol: toUnusualWhalesShareClassSymbol(normalized), chartAvailable: true } };
}
export function findConfiguredCandleAsset(symbol: string, sp500Symbols: string[] = []) {
  return resolveConfiguredCryptoCandleAsset(symbol) ?? resolveConfiguredFixedCandleAsset(symbol) ?? resolveSp500CandleAsset(symbol, sp500Symbols);
}
