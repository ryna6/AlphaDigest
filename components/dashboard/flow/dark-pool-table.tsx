import Link from "next/link";
import type { DarkPoolFlowRow } from "@/lib/data/schemas/dashboard";
import { formatEtDateTime, timestampTitle } from "@/lib/utils/time";
import { money, number } from "./flow-formatters";

export function DarkPoolTable({
  rows,
  linkTickers = true
}: {
  rows: DarkPoolFlowRow[];
  linkTickers?: boolean;
}) {
  return (
    <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-sidebar text-textMuted">
          <tr>
            {["Executed", "Ticker", "Sector", "Price", "Premium", "Volume"].map((h) => (
              <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.externalId} className="hover:bg-panelHover/60">
              <td
                className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary"
                title={timestampTitle(r.executedAt)}
              >
                {formatEtDateTime(r.executedAt)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2">
                {linkTickers ? (
                  <Link className="text-accentBlue" href={`/flow/dark-pool/${r.ticker}`}>
                    {r.ticker}
                  </Link>
                ) : (
                  <span className="text-textSecondary">{r.ticker}</span>
                )}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {r.sector ?? "—"}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {money(r.price)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {money(r.premium)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                {number(r.volume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
