import type { InsiderCompanyAggregate, InsiderTradeRow } from "./schemas/dashboard";

export function aggregateInsiderTrades(trades: InsiderTradeRow[]): InsiderCompanyAggregate[] {
  const map = new Map<string, InsiderCompanyAggregate>();
  for (const trade of trades) {
    const current = map.get(trade.ticker) ?? {
      ticker: trade.ticker,
      sector: trade.sector,
      tradeCount: 0,
      netShares: 0,
      netValue: 0,
      purchaseCount: 0,
      saleCount: 0
    };
    current.tradeCount += 1;
    current.netShares += trade.amount;
    current.netValue += trade.amount * (trade.price ?? 0);
    if (trade.transactionCode === "P") current.purchaseCount += 1;
    if (trade.transactionCode === "S") current.saleCount += 1;
    if (!current.sector && trade.sector) current.sector = trade.sector;
    map.set(trade.ticker, current);
  }
  return [...map.values()].sort((a, b) => b.tradeCount - a.tradeCount || Math.abs(b.netValue) - Math.abs(a.netValue));
}

export function topInsiderCompanies(trades: InsiderTradeRow[], limit: number) {
  return aggregateInsiderTrades(trades).slice(0, limit);
}
