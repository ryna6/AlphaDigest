"use client";

import { useState } from "react";
import Link from "next/link";
import type { InsiderCompanyAggregate } from "@/lib/data/schemas/dashboard";
import { cn } from "@/lib/utils/cn";
import { formatStockPrice, money, signed } from "./flow-formatters";

const INITIAL_VISIBLE = 15;
const MAX_VISIBLE = 30;

export function InsiderCompaniesViewMore({ companies }: { companies: InsiderCompanyAggregate[] }) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const capped = companies.slice(0, MAX_VISIBLE);
  const shown = capped.slice(0, visible);
  const canShowMore = shown.length < capped.length;

  return (
    <>
      <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead className="bg-sidebar text-textMuted">
            <tr>
              {["Ticker", "Sector", "Trades", "Purchases", "Sales", "Avg Price", "Net Shares", "Net Value"].map((h) => (
                <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.ticker} className="hover:bg-panelHover/60">
                <td className="border-b border-borderStrong/50 px-3 py-2"><Link href={`/flow/insider-trades/${r.ticker}`} className="text-accentBlue">{r.ticker}</Link></td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{r.sector ?? "—"}</td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{r.tradeCount}</td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-positive">{r.purchaseCount}</td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-negative">{r.saleCount}</td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{formatStockPrice(r.averageTradePrice)}</td>
                <td className={cn("border-b border-borderStrong/50 px-3 py-2", r.netShares < 0 ? "text-negative" : r.netShares > 0 ? "text-positive" : "text-textSecondary")}>{signed(r.netShares)}</td>
                <td className={cn("border-b border-borderStrong/50 px-3 py-2", r.netValue < 0 ? "text-negative" : r.netValue > 0 ? "text-positive" : "text-textSecondary")}>{money(r.netValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canShowMore ? (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => setVisible(MAX_VISIBLE)} className="border border-borderStrong px-4 py-2 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary">
            View more
          </button>
        </div>
      ) : null}
    </>
  );
}
