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
type Positioned = HeatmapTile & Rect;

type WeightedTile = HeatmapTile & { area: number };

const sectorAreaPercent: Record<string, number> = {
  Technology: 37.37,
  Utilities: 2.25,
  Financials: 11.87,
  "Health Care": 9.08,
  Energy: 3.02,
  "Consumer Discretionary": 9.38,
  "Consumer Staples": 4.67,
  Industrials: 8.88,
  Materials: 1.84,
  "Communication Services": 9.76,
  "Real Estate": 1.88
};

const sectorOrder = ["Technology", "Utilities", "Financials", "Health Care", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Communication Services", "Real Estate"];

function worstAspectRatio(row: WeightedTile[], side: number) {
  if (!row.length || side <= 0) return Infinity;
  const sum = row.reduce((total, item) => total + item.area, 0);
  const max = Math.max(...row.map((item) => item.area));
  const min = Math.min(...row.map((item) => item.area));
  if (min <= 0 || sum <= 0) return Infinity;
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function sliceRow(row: WeightedTile[], rect: Rect): { positioned: Positioned[]; remainder: Rect } {
  const rowArea = row.reduce((total, item) => total + item.area, 0);
  if (rect.w >= rect.h) {
    const rowHeight = rowArea / rect.w;
    let x = rect.x;
    const positioned = row.map((item) => {
      const w = item.area / rowHeight;
      const tile = { ...item, x, y: rect.y, w, h: rowHeight };
      x += w;
      return tile;
    });
    return { positioned, remainder: { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: Math.max(0, rect.h - rowHeight) } };
  }
  const rowWidth = rowArea / rect.h;
  let y = rect.y;
  const positioned = row.map((item) => {
    const h = item.area / rowWidth;
    const tile = { ...item, x: rect.x, y, w: rowWidth, h };
    y += h;
    return tile;
  });
  return { positioned, remainder: { x: rect.x + rowWidth, y: rect.y, w: Math.max(0, rect.w - rowWidth), h: rect.h } };
}

function squarifiedTreemap(items: HeatmapTile[], rect: Rect): Positioned[] {
  const sorted = [...items].filter((item) => Number.isFinite(item.weight) && item.weight > 0).sort((a, b) => b.weight - a.weight);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (!sorted.length || totalWeight <= 0 || rect.w <= 0 || rect.h <= 0) return [];

  const totalArea = rect.w * rect.h;
  const queue: WeightedTile[] = sorted.map((item) => ({ ...item, area: (item.weight / totalWeight) * totalArea }));
  const positioned: Positioned[] = [];
  let row: WeightedTile[] = [];
  let remaining = { ...rect };

  while (queue.length) {
    const next = queue[0];
    const side = Math.min(remaining.w, remaining.h);
    if (!row.length || worstAspectRatio([...row, next], side) <= worstAspectRatio(row, side)) {
      row.push(queue.shift()!);
    } else {
      const sliced = sliceRow(row, remaining);
      positioned.push(...sliced.positioned);
      remaining = sliced.remainder;
      row = [];
    }
  }

  if (row.length) positioned.push(...sliceRow(row, remaining).positioned);
  return positioned;
}

function insetRect(rect: Rect, inset: number): Rect {
  return { x: rect.x + inset, y: rect.y + inset, w: Math.max(0, rect.w - inset * 2), h: Math.max(0, rect.h - inset * 2) };
}

function TradingTile({ tile }: { tile: Positioned }) {
  const showTicker = tile.w >= 5.5 && tile.h >= 5.5;
  const showChange = tile.w >= 8 && tile.h >= 9;
  const showLogo = tile.w >= 5 && tile.h >= 7 && tile.iconPath;
  return (
    <div className="absolute overflow-hidden border p-1 shadow-[inset_0_0_24px_rgba(0,0,0,0.18)] transition hover:z-10 hover:brightness-110" style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.w}%`, height: `${tile.h}%`, ...colorStyle(tile.changePercent) }} title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}>
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        {showLogo ? <Image src={tile.iconPath!} alt={`${tile.symbol} logo`} width={24} height={24} className="h-6 w-6 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
        {showTicker ? <div className="max-w-full truncate text-sm font-black text-white drop-shadow">{tile.symbol}</div> : null}
        {showChange ? <div className="text-[11px] font-bold text-white/90">{tile.changePercent >= 0 ? "+" : ""}{tile.changePercent.toFixed(2)}%</div> : null}
      </div>
    </div>
  );
}

function TradingViewHeatmap({ tiles, grouping }: { tiles: HeatmapTile[]; grouping: "none" | "sector" }) {
  if (grouping === "sector") {
    const groups = sectorOrder.map((sector) => ({ sector, rows: tiles.filter((t) => (t.sector ?? "Other") === sector), weight: sectorAreaPercent[sector] }));
    const groupRects = squarifiedTreemap(groups.map((g) => ({ symbol: g.sector, label: g.sector, value: 0, changePercent: 0, weight: g.weight })), { x: 0, y: 0, w: 100, h: 100 });
    return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{groupRects.map((rect) => {
      const group = groups.find((g) => g.sector === rect.symbol)!;
      const headerHeight = rect.h >= 8 ? 3.5 : 0;
      const innerRect = insetRect({ x: rect.x, y: rect.y + headerHeight, w: rect.w, h: Math.max(0, rect.h - headerHeight) }, 0.25);
      const inner = squarifiedTreemap(group.rows, innerRect);
      return <div key={group.sector} className="absolute border border-black/50 bg-black/20" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}>{headerHeight ? <div className="h-6 truncate px-2 text-[11px] font-bold uppercase tracking-wide text-white/75">{group.sector}</div> : null}{inner.map((tile) => <TradingTile key={`${group.sector}-${tile.symbol}-${tile.label}`} tile={tile} />)}</div>;
    })}</div>;
  }
  const positioned = squarifiedTreemap(tiles, { x: 0, y: 0, w: 100, h: 100 });
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
