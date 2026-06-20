import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { FlowBackLink } from "@/components/dashboard/flow/back-link";
import { getInsiderTradeDetailPayload } from "@/lib/data/live-dashboard";
import { cn } from "@/lib/utils/cn";
import { formatEtDate, timestampTitle } from "@/lib/utils/time";
import { money, number, signed } from "@/components/dashboard/flow/flow-formatters";

export default async function InsiderTickerPage({ params }: { params: { ticker: string } }) {
  const { payload } = await getInsiderTradeDetailPayload(params.ticker);
  const a = payload.aggregate;
  return (
    <>
      <PageTitle
        title={`${payload.ticker} Insider Trades`}
        subtitle="Individual cached insider transactions over the past 3 months."
      />
      <FlowBackLink href="/flow/insider-trades" />
      <Panel>
        {a ? (
          [
            { label: "Total trades", value: String(a.tradeCount), tone: "neutral" as const },
            {
              label: "Net shares",
              value: signed(a.netShares),
              tone:
                a.netShares < 0
                  ? ("negative" as const)
                  : a.netShares > 0
                    ? ("positive" as const)
                    : ("neutral" as const)
            },
            {
              label: "Net value",
              value: money(a.netValue),
              tone:
                a.netValue < 0
                  ? ("negative" as const)
                  : a.netValue > 0
                    ? ("positive" as const)
                    : ("neutral" as const)
            },
            {
              label: "Purchases / Sales",
              value: `${a.purchaseCount} / ${a.saleCount}`,
              tone: "neutral" as const
            }
          ].map((m) => <MetricRow key={m.label} metric={m} />)
        ) : (
          <p className="text-sm text-textMuted">No aggregate rows available.</p>
        )}
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Individual Trades" />
        <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
          <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
            <thead className="bg-sidebar text-textMuted">
              <tr>
                {[
                  "Ticker",
                  "Date",
                  "Owner",
                  "Title",
                  "Code",
                  "Shares",
                  "Price",
                  "Value",
                  "Shares Owned After"
                ].map((h) => (
                  <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.trades.map((t) => (
                <tr key={t.externalId} className="hover:bg-panelHover/60">
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {t.ticker}
                  </td>
                  <td
                    className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary"
                    title={timestampTitle(t.transactionDate)}
                  >
                    {formatEtDate(t.transactionDate)}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {t.ownerName ?? "—"}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {t.officerTitle ?? ""}
                  </td>
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-3 py-2",
                      t.transactionCode === "S" ? "text-negative" : "text-positive"
                    )}
                  >
                    {t.transactionCode}
                  </td>
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-3 py-2",
                      t.amount < 0 ? "text-negative" : "text-positive"
                    )}
                  >
                    {signed(t.amount)}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {money(t.price)}
                  </td>
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-3 py-2",
                      t.amount < 0 ? "text-negative" : "text-positive"
                    )}
                  >
                    {money(t.amount * (t.price ?? 0))}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">
                    {number(t.sharesOwnedAfter)}
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
