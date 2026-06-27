"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { EconomyCardSnapshot, EconomyMetricSnapshot } from "@/lib/data/economy-config";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

function formatValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 }).format(value);
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

function MiniSeriesChart({ metric }: { metric: EconomyMetricSnapshot }) {
  const data = useMemo(() => (metric.history ?? []).map((point) => ({ ...point, label: point.date })), [metric.history]);
  if (!data.length) {
    return <div className="flex h-24 items-center justify-center rounded-none border border-dashed border-borderStrong bg-sidebar/50 text-sm text-textMuted">—</div>;
  }
  return (
    <div className="h-28 rounded-none border border-borderStrong bg-sidebar/50 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid rgba(148,163,184,.35)", borderRadius: 0, color: "#F8FAFC" }}
            formatter={(value) => [formatValue(Number(value)), metric.label]}
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
                className={`min-h-20 rounded-none border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent/70 ${active ? "border-accent bg-accent/10" : "border-borderStrong bg-sidebar hover:border-accent/60"}`}
                aria-pressed={active}
              >
                <span className="block text-xs text-textMuted">{metric.label}</span>
                <span className="mt-1 block text-sm font-semibold text-textPrimary">{formatValue(metric.latestValue)}</span>
                <span className="mt-1 block text-[11px] text-textMuted">{metric.latestDate ?? metric.seriesId ?? "—"}</span>
              </button>
            );
          })}
        </div>
        {card.hasMiniChart && selectedMetric ? <MiniSeriesChart metric={selectedMetric} /> : null}
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
