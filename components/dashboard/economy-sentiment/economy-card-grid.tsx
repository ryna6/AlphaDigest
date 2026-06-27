"use client";

import { useMemo, useState } from "react";
import { Label, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EconomyCardSnapshot, EconomyChangeSnapshot, EconomyMetricSnapshot } from "@/lib/data/economy-config";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

function scaledValue(metric: EconomyMetricSnapshot, value: number) {
  if (metric.valueFormat === "currency-trillions") {
    if (metric.unit.toLowerCase().includes("millions")) return value / 1_000_000;
    if (metric.unit.toLowerCase().includes("billions")) return value / 1_000;
  }
  if (metric.valueFormat === "currency-billions" && metric.unit.toLowerCase().includes("millions")) return value / 1_000;
  if (metric.valueFormat === "persons-thousands") return value / 1_000;
  return value;
}

function formatScaledMetricValue(metric: EconomyMetricSnapshot, scaled: number | null | undefined) {
  if (scaled == null || !Number.isFinite(scaled)) return "—";
  const number = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(scaled);
  if (metric.valueFormat === "percent") return `${number}%`;
  if (metric.valueFormat === "currency-trillions") return `$${number}T`;
  if (metric.valueFormat === "currency-billions") return `$${number}B`;
  if (metric.valueFormat === "persons-thousands") return `${number}M`;
  if (metric.unit.toLowerCase().includes("dollars per hour")) return `$${number}`;
  return number;
}

function formatMetricValue(metric: EconomyMetricSnapshot, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatScaledMetricValue(metric, scaledValue(metric, value));
}

function formatChange(change: EconomyChangeSnapshot | undefined) {
  if (!change || change.value == null || !Number.isFinite(change.value)) return "—";
  const sign = change.value > 0 ? "+" : "";
  const value = `${sign}${change.value.toFixed(2)}`;
  if (change.mode === "percentage-point") return `${value} pp`;
  if (change.mode === "percent") return `${value}%`;
  return value;
}

function changeTone(change: EconomyChangeSnapshot | undefined) {
  if (!change || change.value == null || !Number.isFinite(change.value) || change.value === 0) return "text-textMuted";
  return change.value > 0 ? "text-positive" : "text-negative";
}

function SummaryCard({ card }: { card: EconomyCardSnapshot }) {
  return (
    <Panel>
      <SectionHeader title={card.title} info={card.description} />
      <div className="space-y-3">
        <span className="rounded-full border border-borderStrong bg-sidebar px-3 py-1 text-xs font-semibold text-textSecondary">{card.statusLabel}</span>
        <div className="rounded-none border border-borderStrong bg-sidebar/70 p-3">
          <p className="text-xs font-semibold text-textSecondary">Derived signal</p>
          <p className="mt-1 text-xs text-textMuted">{card.derivedFrom?.join(" · ") ?? "—"}</p>
        </div>
      </div>
    </Panel>
  );
}

function MetricDetailBox({ metric }: { metric: EconomyMetricSnapshot }) {
  return (
    <div className="rounded-none border border-borderStrong bg-sidebar/60 p-3 text-xs text-textMuted">
      <p className="font-semibold text-textSecondary">{metric.fullName}</p>
      <p className="mt-1">
        Range: 10Y · Frequency: {metric.frequency} · Unit: {metric.unit} · {metric.seasonalAdjustment} · Latest: {metric.latestDate ?? "—"} · Source: {metric.dataSource ?? "FRED"}
      </p>
    </div>
  );
}

function MiniSeriesChart({ metric }: { metric: EconomyMetricSnapshot }) {
  const data = useMemo(
    () => (metric.history ?? []).map((point) => ({ date: point.date, value: scaledValue(metric, point.value) })),
    [metric]
  );
  if (!data.length) {
    return <div className="flex h-44 items-center justify-center rounded-none border border-dashed border-borderStrong bg-sidebar/50 text-sm text-textMuted sm:h-52">—</div>;
  }
  return (
    <div className="h-44 rounded-none border border-borderStrong bg-sidebar/50 p-2 sm:h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 8, top: 12, bottom: 18 }}>
          <XAxis dataKey="date" tick={false} axisLine={{ stroke: "rgba(148,163,184,.35)" }} tickLine={false} minTickGap={24}>
            <Label value="Time" position="insideBottom" offset={-12} fill="rgba(148,163,184,.85)" fontSize={11} />
          </XAxis>
          <YAxis width={34} domain={["dataMin", "dataMax"]} tick={{ fill: "rgba(148,163,184,.85)", fontSize: 10 }} axisLine={{ stroke: "rgba(148,163,184,.35)" }} tickLine={false} tickFormatter={(value) => Number(value).toFixed(2)}>
            <Label value={metric.chartAxisLabel} angle={-90} position="insideLeft" offset={0} fill="rgba(148,163,184,.85)" fontSize={11} />
          </YAxis>
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.35)", borderRadius: 0, color: "#F8FAFC" }}
            formatter={(value) => [formatScaledMetricValue(metric, Number(value)), metric.label]}
            labelFormatter={(label) => String(label)}
          />
          <Line type="monotone" dataKey="value" stroke="#4F8CFF" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EconomyMetricCard({ card }: { card: EconomyCardSnapshot }) {
  const [selectedMetricId, setSelectedMetricId] = useState(card.metrics[0]?.id ?? "");
  const selectedMetric = card.metrics.find((metric) => metric.id === selectedMetricId) ?? card.metrics[0];

  return (
    <Panel>
      <SectionHeader title={card.title} info={card.description} />
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {card.metrics.map((metric) => {
            const active = metric.id === selectedMetric?.id;
            return (
              <button
                key={metric.id}
                type="button"
                onClick={() => setSelectedMetricId(metric.id)}
                className={`min-h-24 rounded-none border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/70 ${active ? "border-accent bg-accent/10" : "border-borderStrong bg-sidebar hover:border-accent/60"}`}
                aria-pressed={active}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-xs text-textMuted">{metric.label}</span>
                    <span className="mt-1 block text-sm font-semibold text-textPrimary">{formatMetricValue(metric, metric.latestValue)}</span>
                    <span className="mt-1 block text-[11px] text-textMuted">{metric.unit}</span>
                  </span>
                  <span className="grid shrink-0 grid-cols-2 gap-x-3 text-right text-[11px] leading-5">
                    <span className="text-textMuted">QoQ</span>
                    <span className={changeTone(metric.qoqChange)}>{formatChange(metric.qoqChange)}</span>
                    <span className="text-textMuted">YoY</span>
                    <span className={changeTone(metric.yoyChange)}>{formatChange(metric.yoyChange)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {card.hasMiniChart && selectedMetric ? (
          <>
            <MetricDetailBox metric={selectedMetric} />
            <MiniSeriesChart metric={selectedMetric} />
          </>
        ) : null}
      </div>
    </Panel>
  );
}

export function EconomyCardGrid({ summaryCards, mainCards }: { summaryCards: EconomyCardSnapshot[]; mainCards: EconomyCardSnapshot[] }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => <SummaryCard key={card.id} card={card} />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {mainCards.map((card) => <EconomyMetricCard key={card.id} card={card} />)}
      </div>
    </>
  );
}
