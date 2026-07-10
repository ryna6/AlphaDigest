"use client";
import { useState } from "react";
import type { MarketsPayload } from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Heatmap } from "@/components/ui/heatmap";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils/cn";
import { parseMarketMoverValue } from "@/lib/data/market-movers-display";

const modes = ["globalMarkets", "sectors", "sp500", "crypto", "macro"] as const;
const labels = {
  globalMarkets: "Global Markets",
  sectors: "Sectors",
  crypto: "Crypto",
  macro: "Macro",
  sp500: "S&P 500"
};

const participationInfoText =
  "Participation shows the percentage of stocks in the S&P 500 that are moving in the same direction as the index. Higher participation % indicates a broader, stronger market move, while lower participation % suggests the index is being driven by a smaller number of stocks.";

function MarketBreadthRow({ metric }: { metric: MarketsPayload["breadth"][number] }) {
  if (metric.label !== "Participation") return <MetricRow metric={metric} density="roomy" />;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-borderStrong/60 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm text-textMuted">{metric.label}</p>
          <InfoTooltip text={participationInfoText} placement="right" size="default" />
        </div>
      </div>
      <div className="shrink-0 text-right tabular">
        <p className="text-base font-semibold text-textPrimary">{metric.value}</p>
      </div>
    </div>
  );
}

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

function MarketMoverSection({ metric }: { metric: MarketsPayload["movers"][number] }) {
  const rows = parseMarketMoverValue(metric.value);
  const isNegative = metric.tone === "negative";
  return (
    <div className="rounded-none border border-borderStrong/70 bg-sidebar/45 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-borderStrong/60 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-textMuted">
        <span>{metric.label}</span>
        <span>% Change</span>
      </div>
      <div className="space-y-1.5">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              key={`${metric.label}-${row.ticker}-${index}`}
              className="flex items-center justify-between gap-4 border-b border-borderStrong/30 pb-1.5 last:border-b-0 last:pb-0"
            >
              <span className="min-w-0 truncate text-sm font-medium text-textPrimary">
                {row.ticker}
              </span>
              <span
                className={cn(
                  "shrink-0 text-right text-sm font-semibold tabular",
                  row.percent == null
                    ? "text-textSecondary"
                    : isNegative
                      ? "text-negative"
                      : "text-positive"
                )}
              >
                {row.percent ?? "—"}
              </span>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-textPrimary">—</span>
            <span className="text-sm text-textSecondary tabular">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function MarketsView({ data }: { data: MarketsPayload }) {
  const [mode, setMode] = useState<(typeof modes)[number]>("globalMarkets");
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
              className="min-h-28 rounded-none border border-borderStrong bg-sidebar p-4 transition duration-200 hover:-translate-y-0.5"
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
                <button
                  key={grouping}
                  onClick={() => setSp500Grouping(grouping)}
                  className={cn(
                    "rounded-none px-4 py-2 text-xs font-semibold transition",
                    sp500Grouping === grouping
                      ? "bg-accentBlue text-white shadow-[0_0_18px_rgba(79,140,255,0.35)]"
                      : "text-textSecondary hover:bg-panelHover hover:text-textPrimary"
                  )}
                >
                  {grouping === "none" ? "No Group" : "Sector"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Heatmap
          tiles={data.heatmaps[mode]}
          variant={mode === "sp500" ? "trading" : "grid"}
          grouping={sp500Grouping}
        />
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Market Breadth" />
          {data.breadth.map((m) => (
            <MarketBreadthRow key={m.label} metric={m} />
          ))}
        </Panel>
        <Panel>
          <SectionHeader title="Market Movers" />
          {data.movers.map((m) => (
            <MarketMoverSection key={m.label} metric={m} />
          ))}
        </Panel>
      </div>
    </>
  );
}
