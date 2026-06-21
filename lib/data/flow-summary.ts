import type { DarkPoolFlowRow, InsiderTradeRow, WhaleFeedRow } from "./schemas/dashboard";
import { DARK_POOL_RETENTION_DAYS } from "./adapters/unusual-whales-dark-pool";
import type { Metric } from "./schemas/common";
// Keep a small neutral band around 50% so rounding noise does not overstate direction.
const NEUTRAL_LOW = 0.495;
const NEUTRAL_HIGH = 0.505;
export const WHALE_FEED_SUMMARY_WINDOW_DAYS = 7;

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

function percentOf(numerator?: number | null, denominator?: number | null) {
  if (
    numerator == null ||
    denominator == null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  )
    return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(numerator / denominator);
}

function format30dVolumeSubtext(size?: number | null, avg30Volume?: number | null) {
  const percentage = percentOf(size, avg30Volume);
  return percentage === "—" ? percentage : `${percentage} of 30D Vol`;
}

function isWithinDays(dateValue: string | null | undefined, days: number) {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return false;
  return time >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function normalizeSentiment(sentiment: WhaleFeedRow["sentiment"] | null | undefined) {
  return sentiment === "bullish" || sentiment === "bearish" ? sentiment : "unknown";
}

function capitalizeSentiment(sentiment: WhaleFeedRow["sentiment"] | null | undefined) {
  const normalized = normalizeSentiment(sentiment);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function sentimentTone(sentiment: WhaleFeedRow["sentiment"] | null | undefined) {
  const normalized = normalizeSentiment(sentiment);
  return normalized === "bullish" ? "positive" : normalized === "bearish" ? "negative" : "neutral";
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
  whaleTrades: WhaleFeedRow[];
}): FlowSummaryMetric[] {
  const largest = [...darkPool].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const whaleRows7d = whaleTrades.filter((row) => isWithinDays(row.executedAt, WHALE_FEED_SUMMARY_WINDOW_DAYS));
  const whale = [...whaleRows7d].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
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
      label: `Largest Dark Pool Print (${DARK_POOL_RETENTION_DAYS}D)`,
      value: largest ? largest.ticker : "—",
      subtext: largest ? format30dVolumeSubtext(largest.size, largest.avg30Volume) : undefined,
      change: largest ? money(largest.premium) : undefined,
      href: largest
        ? `/flow/dark-pool/${largest.ticker}`
        : darkPool.length
          ? "/flow/dark-pool"
          : undefined,
      tone: "neutral"
    },
    {
      label: "Whale Feed (7D)",
      value: whale ? whale.ticker : "—",
      subtext: whale ? capitalizeSentiment(whale.sentiment) : undefined,
      change: whale ? money(whale.premium) : undefined,
      href: whale?.ticker ? `/flow/whale-feed/${whale.ticker}` : whale ? "/flow/whale-feed" : undefined,
      tone: sentimentTone(whale?.sentiment)
    }
  ];
}
