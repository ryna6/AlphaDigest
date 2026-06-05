"use client";
import { useState } from "react";
import type { MarketsPayload } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { Heatmap } from "@/components/ui/heatmap";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils/cn";

const modes = ["globalMarkets", "sectors", "crypto", "macro"] as const;
const labels = {
  globalMarkets: "Global Markets",
  sectors: "Sectors",
  crypto: "Crypto",
  macro: "Macro"
};

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

export function MarketsView({ data }: { data: MarketsPayload }) {
  const [mode, setMode] = useState<(typeof modes)[number]>("globalMarkets");

  return (
    <>
      <PageTitle title="Markets" subtitle="What is moving across markets." />
      <Panel>
        <SectionHeader title="Indices" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.strip.map((metric) => (
            <div
              key={metric.label}
              className="min-h-32 rounded-xl border border-borderStrong bg-sidebar p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-textMuted">
                {metric.label}
              </p>
              <p className="mt-5 text-2xl font-semibold text-textPrimary">{metric.value}</p>
              {[metric.change, metric.changePercent].filter(Boolean).length ? (
                <div className="mt-3 flex items-center gap-2">
                  {metric.change ? (
                    <span
                      className={cn(
                        "rounded-full border border-current/20 bg-panelHover px-2.5 py-1 text-sm font-semibold",
                        signedValueClass(metric.change)
                      )}
                    >
                      {metric.change}
                    </span>
                  ) : null}
                  {metric.changePercent ? (
                    <span
                      className={cn(
                        "rounded-full border border-current/20 bg-panelHover px-2.5 py-1 text-sm font-semibold",
                        signedValueClass(metric.changePercent)
                      )}
                    >
                      {metric.changePercent}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Heatmap" />
        {data.heatmapKeyMessages.length ? (
          <div className="mb-3 grid gap-2">
            {data.heatmapKeyMessages.map((m) => (
              <ErrorState key={m} message={m} />
            ))}
          </div>
        ) : null}
        <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl border border-borderStrong bg-sidebar/80 p-1 shadow-inner">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold transition",
                mode === m
                  ? "bg-accentBlue text-white shadow-[0_0_18px_rgba(79,140,255,0.35)]"
                  : "text-textSecondary hover:bg-panelHover hover:text-textPrimary"
              )}
            >
              {labels[m]}
            </button>
          ))}
        </div>
        <Heatmap tiles={data.heatmaps[mode]} />
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Market Breadth" />
          {data.breadth.map((m) => (
            <MetricRow key={m.label} metric={m} />
          ))}
        </Panel>
        <Panel>
          <SectionHeader title="Movers / Leaders / Laggards" />
          {data.movers.map((m) => (
            <MetricRow key={m.label} metric={m} />
          ))}
        </Panel>
      </div>
    </>
  );
}
