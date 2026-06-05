"use client";
import { useState } from "react";
import type { MarketsPayload } from "@/lib/data/schemas/dashboard";
import type { Metric } from "@/lib/data/schemas/common";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { Heatmap } from "@/components/ui/heatmap";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils/cn";

const modes = ["globalMarkets", "sectors", "crypto", "macro"] as const;
const labels = { globalMarkets: "Global Markets", sectors: "Sectors", crypto: "Crypto", macro: "Macro" };

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

function MarketStripCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-h-32 rounded-xl border border-borderStrong bg-sidebar p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">{metric.label}</p>
          <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
          {[metric.change, metric.changePercent].filter(Boolean).length ? (
            <p className={cn("mt-2 text-sm", signedValueClass([metric.change, metric.changePercent].filter(Boolean).join(" ")))}>
              {[metric.change, metric.changePercent].filter(Boolean).join(" ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function MarketsView({ data }: { data: MarketsPayload }) {
  const [mode, setMode] = useState<(typeof modes)[number]>("globalMarkets");
  return (
    <>
      <PageTitle title="Markets" subtitle="What is moving across markets." />
      <Panel>
        <SectionHeader title="Top Market Strip" subtitle="Cross-asset snapshot" />
        <MarketStripCards metrics={data.strip} />
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Heatmap" subtitle="Tiles sized by logical asset weight; color shows percentage change." />
        {data.heatmapKeyMessages.length ? <div className="mb-3 grid gap-2">{data.heatmapKeyMessages.map((m) => <ErrorState key={m} message={m} />)}</div> : null}
        <div className="mb-4 flex flex-wrap gap-2">
          {modes.map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-xs ${mode === m ? "border-accentBlue bg-accentBlue/10 text-accentBlue" : "border-borderStrong text-textMuted"}`}>
              {labels[m]}
            </button>
          ))}
        </div>
        <Heatmap tiles={data.heatmaps[mode]} />
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Market Breadth" />
          {data.breadth.map((m) => <MetricRow key={m.label} metric={m} />)}
        </Panel>
        <Panel>
          <SectionHeader title="Movers / Leaders / Laggards" />
          {data.movers.map((m) => <MetricRow key={m.label} metric={m} />)}
        </Panel>
      </div>
    </>
  );
}
