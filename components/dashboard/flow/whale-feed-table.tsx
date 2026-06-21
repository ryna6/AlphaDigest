import Link from "next/link";
import type { WhaleFeedRow } from "@/lib/data/schemas/dashboard";
import { formatDarkPoolExecutedAt, timestampTitle } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { money, formatStockPrice } from "./flow-formatters";
import { percentOf } from "./flow-trade-formatters";

const sentimentClass = {
  bullish: "text-positive",
  bearish: "text-negative",
  unknown: "text-textSecondary"
} as const;

export function WhaleFeedTable({
  rows,
  linkTickers = true
}: {
  rows: WhaleFeedRow[];
  linkTickers?: boolean;
}) {
  return (
    <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
      <table className="w-full min-w-[900px] border-collapse text-left text-xs">
        <thead className="bg-sidebar text-textMuted">
          <tr>
            {["Time", "Ticker", "Sector", "Sentiment", "Price", "Premium", "% Vol", "% 30D Vol"].map((h) => (
              <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.externalId} className="hover:bg-panelHover/60">
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary" title={timestampTitle(r.executedAt)}>
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
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{r.sector ?? "—"}</td>
              <td className={cn("border-b border-borderStrong/50 px-3 py-2 capitalize", sentimentClass[r.sentiment])}>{r.sentiment}</td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{formatStockPrice(r.price)}</td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{money(r.premium)}</td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{percentOf(r.size, r.volume)}</td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{percentOf(r.size, r.avg30Volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
