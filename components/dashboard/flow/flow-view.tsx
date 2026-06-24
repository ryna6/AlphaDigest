import Link from "next/link";
import { getFlowPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";

import { cn } from "@/lib/utils/cn";
import { DarkPoolTable } from "./dark-pool-table";
import { WhaleFeedTable } from "./whale-feed-table";
import { formatStockPrice, money, signed } from "./flow-formatters";

const INSIDER_SENTIMENT_TOOLTIP =
  "This metric compares the total value of insider purchases to total insider trading activity.\n\nWhen the ratio > 0.5, insiders are buying more than they are selling, suggesting more bullish sentiment. When the ratio < 0.5, insiders are selling more than they are buying, suggesting more bearish sentiment.";

const toneClass = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-textSecondary",
  warning: "text-warning"
} as const;

const viewAll = (href: string) => (
  <Link
    href={href}
    className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
  >
    View All
  </Link>
);

function summaryDisplayLabel(label: string) {
  if (label === "Dark Pool Signal") return "Dark Pool Print";
  if (label === "Whale Feed Signal") return "Whale Feed (7D)";
  return label;
}

function SummaryCard({ metric }: { metric: any }) {
  const displayLabel = summaryDisplayLabel(metric.label);
  const body = (
    <div
      className={cn(
        "flex h-full min-h-32 flex-col rounded-none border border-borderStrong bg-sidebar p-4",
        metric.href && "cursor-pointer transition duration-200 hover:-translate-y-0.5 hover:border-accentBlue/50 hover:bg-panelHover/60 hover:brightness-110"
      )}
    >
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-textMuted">
          {displayLabel}
        </p>
        {displayLabel === "Insider sentiment" ? (
          <InfoTooltip text={INSIDER_SENTIMENT_TOOLTIP} placement="right" />
        ) : null}
      </div>
      <div className="mt-3 flex flex-1 flex-col justify-center">
        <div className="flex items-baseline gap-12">
          <p
            className={cn(
              "text-2xl font-semibold tabular",
              displayLabel === "Insider sentiment"
                ? toneClass[metric.tone as keyof typeof toneClass]
                : "text-textPrimary"
            )}
          >
            {metric.value}
          </p>
          {metric.subtext ? (
            <p
              className={cn(
                "text-sm font-medium",
                toneClass[metric.tone as keyof typeof toneClass]
              )}
            >
              {metric.subtext}
            </p>
          ) : null}
        </div>
        {metric.change ? (
          <p className="mt-1 line-clamp-2 text-sm text-textSecondary">{metric.change}</p>
        ) : null}
      </div>
    </div>
  );
  return metric.href ? (
    <Link
      href={metric.href}
      className="block h-full focus:outline-none focus:ring-1 focus:ring-accentBlue"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

const summaryOrder = [
  "Insider sentiment",
  "Dark Pool Print",
  "Largest Dark Pool Print (7D)",
  "Largest Dark Pool Print (30D)",
  "Dark Pool Signal",
  "Whale Feed (7D)",
  "Whale Feed",
  "Whale Feed Signal"
];

function orderedSummary(summary: Array<{ label: string }>) {
  return [...summary].sort((a, b) => {
    const aIndex = summaryOrder.indexOf(a.label);
    const bIndex = summaryOrder.indexOf(b.label);
    return (
      (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
      (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
    );
  });
}

export async function FlowView() {
  const { payload } = await getFlowPayload();
  const summary = orderedSummary(payload.summary);
  return (
    <>
      <PageTitle title="Flow" />
      <Panel>
        <SectionHeader title="Flow Summary" />
        <div className="grid gap-3 md:grid-cols-3">
          {summary.map((m) => (
            <SummaryCard key={m.label} metric={m} />
          ))}
        </div>
      </Panel>
      <div className="mt-4 space-y-4">
        <Panel>
          <SectionHeader
            title="Insider Trades"
            action={viewAll("/flow/insider-trades")}
          />
          <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
            <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
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
                      {formatStockPrice(r.averageTradePrice)}
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
        <Panel>
          <SectionHeader
            title="Dark Pool"
            action={viewAll("/flow/dark-pool")}
          />
          <DarkPoolTable rows={payload.darkPool.slice(0, 5)} />
        </Panel>
        <Panel>
          <SectionHeader
            title="Whale Feed"
            action={viewAll("/flow/whale-feed")}
          />
          <WhaleFeedTable rows={payload.whaleTrades.slice(0, 5)} />
        </Panel>
      </div>
    </>
  );
}
