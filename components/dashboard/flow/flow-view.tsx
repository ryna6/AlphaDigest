import Link from "next/link";
import { getFlowPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils/cn";

const money = (v: number | null) => v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(v);
const number = (v: number | null) => v == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact" }).format(v);
const signed = (v: number) => `${v >= 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)}`;

export async function FlowView() {
  const { payload } = await getFlowPayload();
  return (
    <>
      <PageTitle title="Flow" />
      <Panel>
        <SectionHeader title="Flow Summary" subtitle="Dark pool and insider data read from Supabase cache when available; whale trades remain fixture-backed." />
        {payload.summary.map((m) => <MetricRow key={m.label} metric={m} />)}
      </Panel>
      {payload.notices.length ? <p className="mt-3 border border-borderStrong bg-sidebar p-3 text-xs text-textMuted">{payload.notices.join(" ")}</p> : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Dark Pool" subtitle="Large unusual prints, sorted by premium; delayed data is expected on the current UW plan." />
          <DataTable rows={payload.darkPool.map((r) => ({ Executed: new Date(r.executedAt).toLocaleString(), Ticker: r.ticker, Sector: r.sector ?? "—", Price: money(r.price), Premium: money(r.premium), Volume: number(r.volume) }))} />
        </Panel>
        <Panel>
          <SectionHeader title="Whale Trades" subtitle="Fixture-backed placeholder until a live endpoint is added." />
          <DataTable rows={payload.whaleTrades} />
        </Panel>
        <Panel className="xl:col-span-2">
          <SectionHeader title="Insider Trades" subtitle="Top 5 companies by insider trade count over the past 3 months." action={<Link className="border border-borderStrong px-2 py-1 text-xs text-accentBlue hover:bg-panelHover" href="/flow/insider-trades">View All</Link>} />
          <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="bg-sidebar text-textMuted"><tr>{["Ticker","Sector","Trades","Net Shares","Net Value"].map((h)=><th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{payload.insiderTrades.map((r)=><tr key={r.ticker} className="hover:bg-panelHover/60"><td className="border-b border-borderStrong/50 px-3 py-2"><Link className="text-accentBlue" href={`/flow/insider-trades/${r.ticker}`}>{r.ticker}</Link></td><td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{r.sector ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 text-textSecondary">{r.tradeCount}</td><td className={cn("border-b border-borderStrong/50 px-3 py-2", r.netShares < 0 ? "text-negative" : r.netShares > 0 ? "text-positive" : "text-textSecondary")}>{signed(r.netShares)}</td><td className={cn("border-b border-borderStrong/50 px-3 py-2", r.netValue < 0 ? "text-negative" : r.netValue > 0 ? "text-positive" : "text-textSecondary")}>{money(r.netValue)}</td></tr>)}</tbody></table>
          </div>
        </Panel>
      </div>
    </>
  );
}
