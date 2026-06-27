import Link from "next/link";
import type { WhaleFeedRow } from "@/lib/data/schemas/dashboard";
import { formatDarkPoolExecutedAt, timestampTitle } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { money, formatStockPrice } from "./flow-formatters";
import { percentOf } from "./flow-trade-formatters";
import { InfoTooltip } from "@/components/ui/info-tooltip";

const SENTIMENT_TOOLTIP =
  "Bid/Ask Execution indicates where a trade was filled relative to the market price.\n\nTrades executed at the ask may signal aggressive buying (Bullish), while trades executed at the bid may signal aggressive selling (Bearish). Although this provides insight into buyer or seller initiative, it does not definitively reveal the trader's intent.";

const sentimentClass = {
  bullish: "text-positive",
  bearish: "text-negative",
  unknown: "text-textSecondary"
} as const;

export function WhaleFeedTable({
  rows,
  linkTickers = true,
  showSentimentInfo = false
}: {
  rows: WhaleFeedRow[];
  linkTickers?: boolean;
  showSentimentInfo?: boolean;
}) {
  return (
    <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
      <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
        <thead className="bg-sidebar text-textMuted">
          <tr>
            {["Date", "Ticker", "Sector", "Sentiment", "Price", "Value", "% Vol", "% 30D Vol"].map(
              (h) => (
                <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                  {h === "Sentiment" && showSentimentInfo ? (
                    <span className="inline-flex items-center gap-1.5">
                      {h}
                      <InfoTooltip text={SENTIMENT_TOOLTIP} placement="right" size="compact" />
                    </span>
                  ) : (
                    h
                  )}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.externalId} className="hover:bg-panelHover/60">
              <td
                className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary"
                title={timestampTitle(r.executedAt)}
              >
                {formatDarkPoolExecutedAt(r.executedAt)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2">
                {linkTickers ? (
                  <Link className="text-accentBlue" href={`/flow/whale-feed/${r.ticker}`}>
                    {r.ticker}
                  </Link>
                ) : (
                  <span className="text-textSecondary">{r.ticker}</span>
                )}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {r.sector ?? "—"}
              </td>
              <td
                className={cn(
                  "border-b border-borderStrong/50 px-3 py-2 capitalize",
                  sentimentClass[r.sentiment]
                )}
              >
                {r.sentiment}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {formatStockPrice(r.price)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {money(r.premium)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {percentOf(r.size, r.volume)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {percentOf(r.size, r.avg30Volume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
