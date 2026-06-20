import Link from "next/link";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { getInsiderTradesPayload } from "@/lib/data/live-dashboard";
import { cn } from "@/lib/utils/cn";
import { money, signed } from "@/components/dashboard/flow/flow-formatters";

export default async function InsiderTradesPage() {
  const { payload } = await getInsiderTradesPayload(25);
  return (
    <>
      <PageTitle
        title="Insider Trades"
        subtitle="Top 25 insider-traded companies over the past 3 months."
      />
      <FlowBackLink href="/flow" />
      <Panel>
        <SectionHeader title="Top Insider-Traded Companies" />
        <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="bg-sidebar text-textMuted">
              <tr>
                {[
                  "Ticker",
                  "Sector",
                  "Trades",
                  "Purchases",
                  "Sales",
                  "Avg Price",
                  "Net Shares",
                  "Net Value"
                ].map((h) => (
                  <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.companies.map((r) => (
                <tr key={r.ticker} className="hover:bg-panelHover/60">
                  <td className="border-b border-borderStrong/50 px-3 py-2">
                    <Link href={`/flow/insider-trades/${r.ticker}`} className="text-accentBlue">
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {r.sector ?? "—"}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {r.tradeCount}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-positive">
                    {r.purchaseCount}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-negative">
                    {r.saleCount}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {money(r.averageTradePrice)}
                  </td>
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-3 py-2",
                      r.netShares < 0
                        ? "text-negative"
                        : r.netShares > 0
                          ? "text-positive"
                          : "text-textSecondary"
                    )}
                  >
                    {signed(r.netShares)}
                  </td>
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-3 py-2",
                      r.netValue < 0
                        ? "text-negative"
                        : r.netValue > 0
                          ? "text-positive"
                          : "text-textSecondary"
                    )}
                  >
                    {money(r.netValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
