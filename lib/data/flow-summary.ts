import type { DarkPoolFlowRow, InsiderTradeRow } from "./schemas/dashboard";
import type { Metric } from "./schemas/common";
// Keep a small neutral band around 50% so rounding noise does not overstate direction.
const NEUTRAL_LOW = 0.495;
const NEUTRAL_HIGH = 0.505;

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
  const denominator = purchaseValue + saleValue;
  const ratio = denominator > 0 ? purchaseValue / denominator : null;
  const label =
    ratio === null
      ? "Neutral"
      : ratio > NEUTRAL_HIGH
        ? "Bullish"
        : ratio < NEUTRAL_LOW
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
      label: "Insider sentiment",
      value: sentiment.ratio === null ? "—" : `${Math.round(sentiment.ratio * 100)}%`,
      subtext: sentiment.label,
      change: `Purchases ${money(sentiment.purchaseValue)} / Sales ${money(sentiment.saleValue)}`,
      href: "/flow/insider-trades",
      tone: sentiment.tone,
      purchaseValue: sentiment.purchaseValue,
      saleValue: sentiment.saleValue,
      ratio: sentiment.ratio
    },
    {
      label: "Dark Pool Print",
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
      label: "Whale Feed",
      value: whale ? Object.values(whale).slice(0, 2).join(" • ") : "—",
      change: whale ? "View whale trades" : undefined,
      href: whale ? "/flow/whale-trades" : undefined,
      tone: "positive"
    }
  ];
}
