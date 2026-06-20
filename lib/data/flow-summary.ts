import type { DarkPoolFlowRow, InsiderTradeRow } from "./schemas/dashboard";
import type { Metric } from "./schemas/common";
const NEUTRAL_LOW = 0.95;
const NEUTRAL_HIGH = 1.05;

export type FlowSummaryMetric = Metric & {
  href?: string;
  subtext?: string;
  purchaseValue?: number;
  saleValue?: number;
  ratio?: number | null;
};

function money(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function deriveInsiderSentiment(trades: InsiderTradeRow[]) {
  let purchaseValue = 0;
  let saleValue = 0;
  for (const trade of trades) {
    if (trade.price === null || !Number.isFinite(trade.price)) continue;
    const value = Math.abs(trade.amount) * trade.price;
    if (!Number.isFinite(value) || value <= 0) continue;
    if (trade.transactionCode === "P" && trade.amount > 0) purchaseValue += value;
    if (trade.transactionCode === "S") saleValue += value;
  }
  const ratio = saleValue > 0 ? purchaseValue / saleValue : null;
  const label =
    saleValue === 0 && purchaseValue > 0
      ? "Bullish"
      : ratio === null
        ? "Neutral"
        : ratio >= NEUTRAL_HIGH
          ? "Bullish"
          : ratio <= NEUTRAL_LOW
            ? "Bearish"
            : "Neutral";
  const tone = label === "Bullish" ? "positive" : label === "Bearish" ? "negative" : "neutral";
  return { purchaseValue, saleValue, ratio, label, tone } as const;
}

export function deriveFlowSummary({
  darkPool,
  insiderRows,
  whaleTrades
}: {
  darkPool: DarkPoolFlowRow[];
  insiderRows: InsiderTradeRow[];
  whaleTrades: Array<Record<string, string>>;
}): FlowSummaryMetric[] {
  const largest = [...darkPool].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const whale = whaleTrades[0];
  const sentiment = deriveInsiderSentiment(insiderRows);
  return [
    {
      label: "Dark Pool Signal",
      value: largest ? `${money(largest.premium)} ${largest.ticker}` : "—",
      change: largest?.sector ?? undefined,
      href: largest
        ? `/flow/dark-pool/${largest.ticker}`
        : darkPool.length
          ? "/flow/dark-pool"
          : undefined,
      tone: "neutral"
    },
    {
      label: "Whale Feed Signal",
      value: whale ? Object.values(whale).slice(0, 2).join(" • ") : "—",
      change: whale ? "View whale trades" : undefined,
      href: whale ? "/flow/whale-trades" : undefined,
      tone: "positive"
    },
    {
      label: "Insider sentiment",
      value:
        sentiment.ratio === null
          ? sentiment.purchaseValue > 0 && sentiment.saleValue === 0
            ? "All buys"
            : "—"
          : `${sentiment.ratio.toFixed(2)}x`,
      subtext: sentiment.label,
      change: `Purchases ${money(sentiment.purchaseValue)} / Sales ${money(sentiment.saleValue)}`,
      href: "/flow/insider-trades",
      tone: sentiment.tone,
      purchaseValue: sentiment.purchaseValue,
      saleValue: sentiment.saleValue,
      ratio: sentiment.ratio
    }
  ];
}
