"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Label, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EconomyCardSnapshot, EconomyChangeSnapshot, EconomyMetricSnapshot } from "@/lib/data/economy-config";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

function scaledValue(_metric: EconomyMetricSnapshot, value: number) {
  return value;
}

function unitPrefix(metric: EconomyMetricSnapshot) {
  return metric.unit.toLowerCase().includes("dollar") ? "$" : "";
}

function unitSuffix(metric: EconomyMetricSnapshot) {
  return metric.valueFormat === "percent" && metric.unit.toLowerCase() === "percent" ? "%" : "";
}

function fractionDigits(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100 || Number.isInteger(value)) return 0;
  if (abs >= 10) return 1;
  return 2;
}

function formatScaledMetricValue(metric: EconomyMetricSnapshot, scaled: number | null | undefined) {
  if (scaled == null || !Number.isFinite(scaled)) return "—";
  const digits = fractionDigits(scaled);
  const number = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(scaled);
  return `${unitPrefix(metric)}${number}${unitSuffix(metric)}`;
}

function formatMetricCardValue(metric: EconomyMetricSnapshot, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  const scaled = scaledValue(metric, value);
  const digits = fractionDigits(scaled);
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(scaled);
}

function metricUnitLabel(metric: EconomyMetricSnapshot) {
  const unit = metric.unit.trim();
  if (metric.valueFormat === "percent" && unit.toLowerCase() === "percent") return "%";
  if (unit.toLowerCase() === "percentage points") return "pp";
  return unit;
}

function chartLabelCoordinate(viewBox: unknown, key: "x" | "y" | "height") {
  if (!viewBox || typeof viewBox !== "object" || !(key in viewBox)) return 0;
  const value = (viewBox as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function YAxisUnitLabel({ viewBox, value }: { viewBox?: unknown; value?: unknown }) {
  const x = chartLabelCoordinate(viewBox, "x") + 10;
  const y = chartLabelCoordinate(viewBox, "y") + chartLabelCoordinate(viewBox, "height") / 2;

  return (
    <text
      x={x}
      y={y}
      fill="rgba(148,163,184,.9)"
      fontSize={12}
      textAnchor="middle"
      dominantBaseline="central"
      transform={`rotate(-90 ${x} ${y})`}
    >
      {String(value ?? "")}
    </text>
  );
}

function formatAxisTick(metric: EconomyMetricSnapshot, value: number) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const notation = abs >= 100000 ? "compact" : "standard";
  const digits = fractionDigits(value);
  const number = new Intl.NumberFormat("en-US", { notation, maximumFractionDigits: notation === "compact" ? 1 : digits }).format(value);
  return `${unitPrefix(metric)}${number}${unitSuffix(metric)}`;
}

function niceInterval(rawInterval: number) {
  if (!Number.isFinite(rawInterval) || rawInterval <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawInterval));
  const normalized = rawInterval / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function chartDomain(values: number[], chartType: "line" | "bar" = "line") {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { domain: [0, 1] as [number, number], ticks: [0, 1] };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const rawRange = max - min;
  const baseRange = rawRange > 0 ? rawRange : Math.max(Math.abs(max), 1) * 0.1;
  const interval = niceInterval(baseRange / 6);
  const lowerRaw = chartType === "bar" ? 0 : min - interval;
  const upperRaw = max + interval;
  let lower = chartType === "bar" ? 0 : Math.floor(lowerRaw / interval) * interval;
  let upper = Math.ceil(upperRaw / interval) * interval;

  if (min >= 0 && lower < 0 && chartType === "line") lower = 0;
  if (lower === upper) upper = lower + interval;

  let ticks = buildTicks(lower, upper, interval);
  if (ticks.length > 10) {
    const widerInterval = niceInterval((upper - lower) / 8);
    lower = chartType === "bar" ? 0 : Math.floor(lowerRaw / widerInterval) * widerInterval;
    if (min >= 0 && lower < 0 && chartType === "line") lower = 0;
    upper = Math.ceil(upperRaw / widerInterval) * widerInterval;
    ticks = buildTicks(lower, upper, widerInterval);
  }

  return { domain: [lower, upper] as [number, number], ticks };
}

function buildTicks(lower: number, upper: number, interval: number) {
  const ticks: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(interval)) + 1);
  for (let value = lower; value <= upper + interval / 2; value += interval) {
    ticks.push(Number(value.toFixed(decimals)));
  }
  return ticks;
}

function formatQuarter(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

function formatPeriod(value: string, metric: EconomyMetricSnapshot) {
  if (metric.frequency === "Quarterly") return formatQuarter(value);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  if (metric.frequency === "Daily" || metric.frequency === "Weekly") return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }).format(date);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatXAxisTick(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return String(date.getUTCFullYear());
}

function EconomyTooltip({ active, payload, label, metric }: { active?: boolean; payload?: ReadonlyArray<{ value?: unknown }>; label?: string | number; metric: EconomyMetricSnapshot }) {
  const value = payload?.[0]?.value;
  if (!active || value == null || !Number.isFinite(Number(value))) return null;
  return (
    <div className="border border-borderStrong bg-[#111827] px-3 py-2 text-sm text-textPrimary shadow-[0_18px_40px_rgba(0,0,0,.35)]">
      <p>{formatPeriod(String(label), metric)}</p>
      <p className="mt-1 font-semibold">{formatScaledMetricValue(metric, Number(value))}</p>
    </div>
  );
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
      <SectionHeader title={card.title} />
      <div className="space-y-3">
        <span className="rounded-full border border-borderStrong bg-sidebar px-3 py-1 text-sm font-semibold text-textSecondary">{card.statusLabel}</span>
        <div className="rounded-none border border-borderStrong bg-sidebar/70 p-3">
          <p className="text-sm font-semibold text-textSecondary">Derived signal</p>
          <p className="mt-1 text-sm text-textMuted">{card.derivedFrom?.join(" · ") ?? "—"}</p>
        </div>
      </div>
    </Panel>
  );
}

function dateRangeLabel(metric: EconomyMetricSnapshot) {
  const history = metric.history ?? [];
  const first = history[0]?.date;
  const latest = metric.latestDate ?? history.at(-1)?.date;
  return `${first ?? "—"} to ${latest ?? "—"}`;
}

function ChartPanel({ metric }: { metric: EconomyMetricSnapshot }) {
  const data = useMemo(
    () => (metric.history ?? []).map((point) => ({ date: point.date, value: scaledValue(metric, point.value) })),
    [metric]
  );
  const yAxis = useMemo(() => chartDomain(data.map((point) => point.value), "line"), [data]);

  return (
    <div className="rounded-none border border-borderStrong bg-gradient-to-b from-sidebar/90 to-background/80 p-4 shadow-[0_0_24px_rgba(15,23,42,.22)]">
      <div className="mb-4 flex flex-col gap-2 border-b border-borderStrong/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-semibold text-textPrimary">{metric.fullName} ({metric.seriesId})</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6 text-textMuted sm:gap-x-4">
            <span>Range: {dateRangeLabel(metric)}</span>
            <span aria-hidden="true" className="text-borderStrong">|</span>
            <span>Frequency: {metric.frequency}</span>
            <span aria-hidden="true" className="text-borderStrong">|</span>
            <span>{metric.seasonalAdjustment}</span>
          </p>
        </div>
        <div className="text-sm text-textMuted sm:text-right">
          <p>Latest observation</p>
          <p className="font-semibold text-textSecondary">{metric.latestDate ?? "—"}</p>
        </div>
      </div>
      {!data.length ? (
        <div className="flex h-72 items-center justify-center rounded-none border border-dashed border-borderStrong bg-background/40 text-sm text-textMuted">—</div>
      ) : (
        <div className="h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 24, right: 18, top: 12, bottom: 12 }}>
              <CartesianGrid stroke="rgba(148,163,184,.14)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(148,163,184,.85)", fontSize: 12 }}
                axisLine={{ stroke: "rgba(148,163,184,.35)" }}
                tickLine={false}
                minTickGap={46}
                tickFormatter={(value) => formatXAxisTick(String(value))}
              />
              <YAxis width={72} domain={yAxis.domain} ticks={yAxis.ticks} tick={{ fill: "rgba(148,163,184,.85)", fontSize: 12 }} axisLine={{ stroke: "rgba(148,163,184,.35)" }} tickLine={false} tickFormatter={(value) => formatAxisTick(metric, Number(value))}>
                <Label value={metric.unit} content={(props) => <YAxisUnitLabel {...props} />} />
              </YAxis>
              <Tooltip cursor={{ stroke: "rgba(79,140,255,.45)", strokeWidth: 1 }} content={(props) => <EconomyTooltip {...props} metric={metric} />} />
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
      <SectionHeader title={card.title} />
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {card.metrics.map((metric) => {
            const active = metric.id === selectedMetric?.id;
            return (
              <button
                key={metric.id}
                type="button"
                onClick={() => setSelectedMetricId(metric.id)}
                className={`min-h-28 rounded-none border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/70 ${active ? "border-accent bg-accent/10" : "border-borderStrong bg-sidebar hover:border-accent/60"}`}
                aria-pressed={active}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm text-textMuted">{metric.label}</span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-xl font-semibold text-textPrimary">{formatMetricCardValue(metric, metric.latestValue)}</span>
                      <span className="max-w-[11rem] text-[11px] leading-3 text-textMuted">{metricUnitLabel(metric)}</span>
                    </span>
                  </span>
                  <span className="grid shrink-0 grid-cols-2 gap-x-3 text-right text-xs leading-5">
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
