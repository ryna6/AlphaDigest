import type { InsiderCompanyAggregate, InsiderTradeRow } from "./schemas/dashboard";

const PAST_3_MONTHS_DAYS = 92;

function cutoffDateKey(referenceDate = new Date()) {
  return new Date(referenceDate.getTime() - PAST_3_MONTHS_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function aggregateInsiderTrades(
  trades: InsiderTradeRow[],
  referenceDate = new Date()
): InsiderCompanyAggregate[] {
  const cutoff = cutoffDateKey(referenceDate);
  const weighted = new Map<string, { shares: number; value: number }>();
  const map = new Map<string, InsiderCompanyAggregate>();

  for (const trade of trades) {
    if (trade.transactionDate.slice(0, 10) < cutoff) continue;

    const current = map.get(trade.ticker) ?? {
      ticker: trade.ticker,
      sector: trade.sector,
      tradeCount: 0,
      netShares: 0,
      netValue: 0,
      purchaseCount: 0,
      saleCount: 0,
      averageTradePrice: null
    };

    current.tradeCount += 1;
    current.netShares += trade.amount;
    current.netValue += trade.amount * (trade.price ?? 0);
    if (trade.transactionCode === "P") current.purchaseCount += 1;
    if (trade.transactionCode === "S") current.saleCount += 1;
    if (!current.sector && trade.sector) current.sector = trade.sector;

    const shares = Math.abs(trade.amount);
    if (trade.price !== null && Number.isFinite(trade.price) && shares > 0) {
      const currentWeighted = weighted.get(trade.ticker) ?? { shares: 0, value: 0 };
      currentWeighted.shares += shares;
      currentWeighted.value += shares * trade.price;
      weighted.set(trade.ticker, currentWeighted);
    }

    map.set(trade.ticker, current);
  }

  for (const aggregate of map.values()) {
    const w = weighted.get(aggregate.ticker);
    aggregate.averageTradePrice = w && w.shares > 0 ? w.value / w.shares : null;
  }

  return [...map.values()].sort(
    (a, b) => b.tradeCount - a.tradeCount || Math.abs(b.netValue) - Math.abs(a.netValue)
  );
}

export function topInsiderCompanies(trades: InsiderTradeRow[], limit: number) {
  return aggregateInsiderTrades(trades).slice(0, limit);
}
