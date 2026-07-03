"use client";

import Image from "next/image";
import type { HeatmapTile } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

function colorStyle(change: number) {
  const clamped = Math.max(-5, Math.min(5, change));
  const intensity = Math.min(1, Math.abs(clamped) / 3);
  if (clamped > 0) return { backgroundColor: `rgb(${18 - intensity * 10}, ${74 + intensity * 88}, ${50 + intensity * 26})`, borderColor: `rgba(34,197,94,${0.35 + intensity * 0.45})` };
  if (clamped < 0) return { backgroundColor: `rgb(${74 + intensity * 66}, ${32 - intensity * 6}, ${37 - intensity * 8})`, borderColor: `rgba(239,68,68,${0.35 + intensity * 0.45})` };
  return { backgroundColor: "rgba(51,65,85,0.75)", borderColor: "rgba(100,116,139,0.55)" };
}

function tileColor(change: number) {
  if (change >= 1) return "border-[#16A34A]/70 bg-[#116C3A] shadow-[inset_0_0_28px_rgba(34,197,94,0.16)]";
  if (change > 0) return "border-[#22C55E]/45 bg-[#174B32] shadow-[inset_0_0_24px_rgba(34,197,94,0.10)]";
  if (change <= -1) return "border-[#DC2626]/70 bg-[#6F1D1D] shadow-[inset_0_0_28px_rgba(239,68,68,0.16)]";
  if (change < 0) return "border-[#EF4444]/45 bg-[#4A2025] shadow-[inset_0_0_24px_rgba(239,68,68,0.10)]";
  return "border-slate-500/50 bg-slate-700/55";
}

function changeTextColor(change: number) {
  if (change > 0) return "text-emerald-100";
  if (change < 0) return "text-red-100";
  return "text-slate-100";
}

type Rect = { x: number; y: number; w: number; h: number };
type WeightedTile = HeatmapTile & { weight: number };
type Positioned = HeatmapTile & Rect;

function asWeightedTiles(items: HeatmapTile[]) {
  return items
    .map((item) => ({ ...item, weight: Math.max(0, item.weight) }))
    .filter((item): item is WeightedTile => item.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

function worst(row: WeightedTile[], side: number) {
  const weights = row.map((item) => item.weight);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function scaleWeights(items: WeightedTile[], rect: Rect) {
  const total = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  const area = rect.w * rect.h;
  return items.map((item) => ({ ...item, weight: (item.weight / total) * area }));
}

function layoutRow(row: WeightedTile[], rect: Rect): { positioned: Positioned[]; rest: Rect } {
  const rowArea = row.reduce((sum, item) => sum + item.weight, 0);
  if (rect.w >= rect.h) {
    const h = rowArea / rect.w;
    let x = rect.x;
    return {
      positioned: row.map((item) => {
        const w = item.weight / h;
        const positioned = { ...item, x, y: rect.y, w, h };
        x += w;
        return positioned;
      }),
      rest: { x: rect.x, y: rect.y + h, w: rect.w, h: Math.max(0, rect.h - h) }
    };
  }
  const w = rowArea / rect.h;
  let y = rect.y;
  return {
    positioned: row.map((item) => {
      const h = item.weight / w;
      const positioned = { ...item, x: rect.x, y, w, h };
      y += h;
      return positioned;
    }),
    rest: { x: rect.x + w, y: rect.y, w: Math.max(0, rect.w - w), h: rect.h }
  };
}

function layout(items: HeatmapTile[], rect: Rect): Positioned[] {
  const remaining = scaleWeights(asWeightedTiles(items), rect);
  const positioned: Positioned[] = [];
  let bounds = rect;
  let row: WeightedTile[] = [];

  while (remaining.length) {
    const item = remaining[0];
    const side = Math.max(0.0001, Math.min(bounds.w, bounds.h));
    if (!row.length || worst([...row, item], side) <= worst(row, side)) {
      row.push(remaining.shift()!);
    } else {
      const result = layoutRow(row, bounds);
      positioned.push(...result.positioned);
      bounds = result.rest;
      row = [];
    }
  }
  if (row.length) positioned.push(...layoutRow(row, bounds).positioned);
  return positioned;
}

const sectorOrder = ["Technology", "Utilities", "Financials", "Health Care", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Communication Services", "Real Estate", "Other"];

function TradingTile({ tile }: { tile: Positioned }) {
  const showTicker = tile.w >= 7 && tile.h >= 8;
  const showChange = tile.w >= 10 && tile.h >= 13;
  const showLogo = tile.w >= 5 && tile.h >= 7 && tile.iconPath && !tile.aggregate;
  return (
    <div className="absolute overflow-hidden border p-1 shadow-[inset_0_0_24px_rgba(0,0,0,0.18)] transition hover:z-10 hover:brightness-110" style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.w}%`, height: `${tile.h}%`, ...colorStyle(tile.changePercent) }} title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}>
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        {showLogo ? <Image src={tile.iconPath!} alt={`${tile.symbol} logo`} width={24} height={24} className="h-6 w-6 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
        {showTicker ? <div className="max-w-full truncate text-sm font-black text-white drop-shadow">{tile.aggregate ? tile.label : tile.symbol}</div> : null}
        {showChange ? <div className="text-[11px] font-bold text-white/90">{tile.changePercent >= 0 ? "+" : ""}{tile.changePercent.toFixed(2)}%</div> : null}
      </div>
    </div>
  );
}

function TradingViewHeatmap({ tiles, grouping }: { tiles: HeatmapTile[]; grouping: "none" | "sector" }) {
  if (grouping === "sector") {
    const groups = sectorOrder.map((sector) => {
      const rows = tiles.filter((t) => (t.sector ?? "Other") === sector);
      return { sector, rows, weight: rows.reduce((s, r) => s + Math.max(0, r.weight), 0) };
    }).filter((g) => g.rows.length);

    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const minHeight = Math.max(14, Math.min(24, 14 + (group.weight / Math.max(...groups.map((g) => g.weight))) * 10));
          const positioned = layout(group.rows, { x: 0, y: 0, w: 100, h: 100 });
          return (
            <section key={group.sector} className="border border-borderStrong bg-[#0b1120] p-3">
              <h3 className="mb-2 truncate text-xs font-bold uppercase tracking-[0.18em] text-white/80">{group.sector}</h3>
              <div className="relative overflow-hidden border border-black/50 bg-black/20" style={{ minHeight: `${minHeight}rem` }}>
                {positioned.map((tile) => <TradingTile key={`${group.sector}-${tile.symbol}-${tile.label}`} tile={tile} />)}
              </div>
            </section>
          );
        })}
      </div>
    );
  }
  const positioned = layout(tiles, { x: 0, y: 0, w: 100, h: 100 });
  return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{positioned.map((tile) => <TradingTile key={`${tile.symbol}-${tile.label}`} tile={tile} />)}</div>;
}

export function Heatmap({ tiles, variant = "grid", grouping = "none" }: { tiles: HeatmapTile[]; variant?: "grid" | "trading"; grouping?: "none" | "sector" }) {
  if (variant === "trading") return <TradingViewHeatmap tiles={tiles} grouping={grouping} />;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div key={`${tile.symbol}-${tile.label}`} className={`min-h-28 border p-3 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 ${tileColor(tile.changePercent)}`} title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}>
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {tile.iconPath ? <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent"><Image src={tile.iconPath} alt={`${tile.label} icon`} width={32} height={32} className="h-full w-full rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span> : null}
              <div className="min-w-0"><p className="truncate text-base font-semibold text-textPrimary">{tile.label}</p><p className="text-xs uppercase tracking-wide text-white/65">{tile.symbol}</p></div>
            </div>
            <p className={cn("shrink-0 text-right tabular text-xl font-bold leading-none", changeTextColor(tile.changePercent))}>{tile.changePercent.toFixed(2)}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}
