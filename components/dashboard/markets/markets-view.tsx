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

const modes = ["globalMarkets", "sectors", "sp500", "crypto", "macro"] as const;
const labels = {
  globalMarkets: "Global Markets",
  sectors: "Sectors",
  crypto: "Crypto",
  macro: "Macro",
  sp500: "S&P 500"
};

function MarketMetricIcon({ src, label }: { src: string; label: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${label} icon`}
        className="h-full w-full rounded-full object-cover"
        onError={() => setHidden(true)}
      />
    </span>
  );
}

function signedValueClass(value?: string) {
  if (!value) return "text-textSecondary";
  if (/^-|\s-/.test(value)) return "text-negative";
  if (/^\+|\s\+/.test(value)) return "text-positive";
  return "text-textSecondary";
}

function MarketMoverValue({
  value,
  tone: metricTone
}: {
  value: string;
  tone: MarketsPayload["movers"][number]["tone"];
}) {
  if (value === "—") return <span className="text-textPrimary">{value}</span>;

  const percentClass = metricTone === "negative" ? "text-negative" : "text-positive";
  return (
    <>
      {value.split(" · ").map((part, index) => {
        const match = part.match(/^(\S+)\s+([+-]\d+(?:\.\d+)?%)$/);
        if (!match) {
          return (
            <span key={`${part}-${index}`} className="text-textPrimary">
              {part}
            </span>
          );
        }
        const [, ticker, percent] = match;
        return (
          <span key={`${ticker}-${percent}-${index}`}>
            {index > 0 ? <span className="text-textSecondary"> · </span> : null}
            <span className="text-textPrimary">{ticker} </span>
            <span className={percentClass}>{percent}</span>
          </span>
        );
      })}
    </>
  );
}

function MarketMoverRow({ metric }: { metric: MarketsPayload["movers"][number] }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-borderStrong/60 py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-textMuted">{metric.label}</p>
        </div>
      </div>
      <div className="text-right tabular">
        <p className="text-base font-semibold">
          <MarketMoverValue value={metric.value} tone={metric.tone} />
        </p>
      </div>
    </div>
  );
}

export function MarketsView({ data }: { data: MarketsPayload }) {
  const [mode, setMode] = useState<(typeof modes)[number]>("sp500");
  const [sp500Grouping, setSp500Grouping] = useState<"none" | "sector">("none");

  return (
    <>
      <PageTitle title="Markets" />
      <Panel>
        <SectionHeader title="Indices" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {data.strip.map((metric) => (
            <div
              key={metric.label}
              className="min-h-28 rounded-none border border-borderStrong bg-sidebar p-4"
            >
              <div className="flex items-center gap-2">
                {metric.iconPath ? (
                  <MarketMetricIcon src={metric.iconPath} label={metric.label} />
                ) : null}
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-textMuted">
                  {metric.label}
                </p>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-2xl font-semibold text-textPrimary">{metric.value}</p>
                  {metric.changePercent ? (
                    <p
                      className={cn(
                        "shrink-0 text-right text-sm font-semibold",
                        signedValueClass(metric.changePercent)
                      )}
                    >
                      {metric.changePercent}
                    </p>
                  ) : null}
                </div>
                {metric.change ? (
                  <p className={cn("mt-2 text-sm", signedValueClass(metric.change))}>
                    {metric.change}
                  </p>
                ) : null}
              </div>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-none border border-borderStrong bg-sidebar/80 p-1 shadow-inner">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-none px-4 py-2 text-xs font-semibold transition",
                  mode === m
                    ? "bg-accentBlue text-white shadow-[0_0_18px_rgba(79,140,255,0.35)]"
                    : "text-textSecondary hover:bg-panelHover hover:text-textPrimary"
                )}
              >
                {labels[m]}
              </button>
            ))}
          </div>
          {mode === "sp500" ? (
            <div className="inline-flex gap-1 rounded-none border border-borderStrong bg-sidebar/80 p-1 shadow-inner">
              {(["none", "sector"] as const).map((grouping) => (
                <button key={grouping} onClick={() => setSp500Grouping(grouping)} className={cn("rounded-none px-4 py-2 text-xs font-semibold transition", sp500Grouping === grouping ? "bg-accentBlue text-white shadow-[0_0_18px_rgba(79,140,255,0.35)]" : "text-textSecondary hover:bg-panelHover hover:text-textPrimary")}>
                  {grouping === "none" ? "No Group" : "Sector"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Heatmap tiles={data.heatmaps[mode]} variant={mode === "sp500" ? "trading" : "grid"} grouping={sp500Grouping} />
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Market Breadth" />
          {data.breadth.map((m) => (
            <MetricRow key={m.label} metric={m} density="roomy" />
          ))}
        </Panel>
        <Panel>
          <SectionHeader title="Market Movers" />
          {data.movers.map((m) => (
            <MarketMoverRow key={m.label} metric={m} />
          ))}
        </Panel>
      </div>
    </>
  );
}
