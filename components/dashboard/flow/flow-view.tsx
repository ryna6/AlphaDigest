import Link from "next/link";
import { getFlowPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils/cn";
import { DarkPoolTable } from "./dark-pool-table";
import { money, signed } from "./flow-formatters";

const viewAll = (href: string) => (
  <Link
    href={href}
    className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
  >
    View All
  </Link>
);

export async function FlowView() {
  const { payload } = await getFlowPayload();
  return (
    <>
      <PageTitle title="Flow" />
      <Panel>
        <SectionHeader title="Flow Summary" />
        {payload.summary.map((m) => (
          <MetricRow key={m.label} metric={m} />
        ))}
      </Panel>
      <div className="mt-4 space-y-4">
        <Panel>
          <SectionHeader
            title="Insider Trades"
            subtitle="Top 5 companies by insider trade count over the past 3 months."
            action={viewAll("/flow/insider-trades")}
          />
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
                {payload.insiderTrades.map((r) => (
                  <tr key={r.ticker} className="hover:bg-panelHover/60">
                    <td className="border-b border-borderStrong/50 px-3 py-2">
                      <Link className="text-accentBlue" href={`/flow/insider-trades/${r.ticker}`}>
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
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <SectionHeader
              title="Dark Pool"
              subtitle="Large unusual prints, sorted by premium; delayed data is expected on the current UW plan."
              action={viewAll("/flow/dark-pool")}
            />
            <DarkPoolTable rows={payload.darkPool.slice(0, 5)} />
          </Panel>
          <Panel>
            <SectionHeader
              title="Whale Trades"
              subtitle="Fixture-backed placeholder until a live endpoint is added."
              action={viewAll("/flow/whale-trades")}
            />
            <DataTable rows={payload.whaleTrades} />
          </Panel>
        </div>
      </div>
    </>
  );
}
