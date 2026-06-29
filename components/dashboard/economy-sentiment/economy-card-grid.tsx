"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Label, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function dateRangeLabel(metric: EconomyMetricSnapshot) {
  const history = metric.history ?? [];
  const first = history[0]?.date;
  const latest = metric.latestDate ?? history.at(-1)?.date;
  if (!first && !latest) return "10Y";
  return `${first ?? "—"} to ${latest ?? "—"}`;
}

function ChartPanel({ metric }: { metric: EconomyMetricSnapshot }) {
  const data = useMemo(
    () => (metric.history ?? []).map((point) => ({ date: point.date, value: scaledValue(metric, point.value) })),
    [metric]
  );

  return (
    <div className="rounded-none border border-borderStrong bg-gradient-to-b from-sidebar/90 to-background/80 p-4 shadow-[0_0_24px_rgba(15,23,42,.22)]">
      <div className="mb-4 flex flex-col gap-2 border-b border-borderStrong/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-textPrimary">{metric.fullName}</p>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Range: 10Y ({dateRangeLabel(metric)}) · Frequency: {metric.frequency} · Unit: {metric.unit} · {metric.seasonalAdjustment} · Source: {metric.dataSource ?? "FRED"}
          </p>
        </div>
        <div className="text-xs text-textMuted sm:text-right">
          <p>Latest observation</p>
          <p className="font-semibold text-textSecondary">{metric.latestDate ?? "—"}</p>
        </div>
      </div>
      {!data.length ? (
        <div className="flex h-72 items-center justify-center rounded-none border border-dashed border-borderStrong bg-background/40 text-sm text-textMuted">—</div>
      ) : (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 4, right: 18, top: 12, bottom: 24 }}>
              <CartesianGrid stroke="rgba(148,163,184,.14)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(148,163,184,.85)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(148,163,184,.35)" }}
                tickLine={false}
                minTickGap={46}
                tickFormatter={formatChartDate}
              >
                <Label value="Time" position="insideBottom" offset={-18} fill="rgba(148,163,184,.9)" fontSize={12} />
              </XAxis>
              <YAxis width={58} domain={["dataMin", "dataMax"]} tick={{ fill: "rgba(148,163,184,.85)", fontSize: 11 }} axisLine={{ stroke: "rgba(148,163,184,.35)" }} tickLine={false} tickFormatter={(value) => Number(value).toFixed(2)}>
                <Label value={metric.chartAxisLabel} angle={-90} position="insideLeft" offset={4} fill="rgba(148,163,184,.9)" fontSize={12} />
              </YAxis>
              <Tooltip
                cursor={{ stroke: "rgba(79,140,255,.45)", strokeWidth: 1 }}
                contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.35)", borderRadius: 0, color: "#F8FAFC", boxShadow: "0 18px 40px rgba(0,0,0,.35)" }}
                formatter={(value) => [formatScaledMetricValue(metric, Number(value)), metric.label]}
                labelFormatter={(label) => `Observation: ${String(label)}`}
              />
              <Line type="monotone" dataKey="value" stroke="#4F8CFF" strokeWidth={2.5} dot={false} activeDot={{ r: 4, stroke: "#93C5FD", strokeWidth: 2, fill: "#0F172A" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
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
        {card.hasMiniChart && selectedMetric ? <ChartPanel metric={selectedMetric} /> : null}
      </div>
    </Panel>
  );
}

export function EconomyCardGrid({ summaryCards, mainCards }: { summaryCards: EconomyCardSnapshot[]; mainCards: EconomyCardSnapshot[] }) {
  const [selectedCardId, setSelectedCardId] = useState(mainCards[0]?.id ?? "");
  const selectedCard = mainCards.find((card) => card.id === selectedCardId) ?? mainCards[0];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => <SummaryCard key={card.id} card={card} />)}
      </div>
      <div className="mt-4 overflow-x-auto border border-borderStrong bg-sidebar/50 p-2">
        <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
          {mainCards.map((card) => {
            const active = card.id === selectedCard?.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedCardId(card.id)}
                className={`rounded-none border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-accent/70 ${active ? "border-accent bg-accent/15 text-textPrimary" : "border-borderStrong bg-background/50 text-textMuted hover:border-accent/60 hover:text-textSecondary"}`}
                aria-pressed={active}
              >
                {card.title}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        {selectedCard ? <EconomyMetricCard key={selectedCard.id} card={selectedCard} /> : null}
      </div>
    </>
  );
}
