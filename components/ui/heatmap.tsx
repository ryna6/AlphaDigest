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

type TreemapItem = HeatmapTile & { weight: number };

function sortedValidTiles(items: HeatmapTile[]) {
  return [...items]
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.symbol.localeCompare(b.symbol));
}

function worstAspect(row: number[], side: number) {
  if (!row.length || side <= 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((total, value) => total + value, 0);
  const min = Math.min(...row);
  const max = Math.max(...row);
  if (sum <= 0 || min <= 0) return Number.POSITIVE_INFINITY;
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function layoutRow(row: TreemapItem[], rowAreas: number[], rect: Rect): { positioned: Positioned[]; remaining: Rect } {
  const rowArea = rowAreas.reduce((sum, area) => sum + area, 0);
  if (rowArea <= 0 || rect.w <= 0 || rect.h <= 0) return { positioned: [], remaining: rect };

  if (rect.w >= rect.h) {
    const rowHeight = Math.min(rect.h, rowArea / rect.w);
    let x = rect.x;
    const positioned = row.map((item, index) => {
      const isLast = index === row.length - 1;
      const w = isLast ? rect.x + rect.w - x : rowAreas[index] / rowHeight;
      const tile = { ...item, x, y: rect.y, w: Math.max(0, w), h: rowHeight };
      x += w;
      return tile;
    });
    return { positioned, remaining: { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: Math.max(0, rect.h - rowHeight) } };
  }

  const rowWidth = Math.min(rect.w, rowArea / rect.h);
  let y = rect.y;
  const positioned = row.map((item, index) => {
    const isLast = index === row.length - 1;
    const h = isLast ? rect.y + rect.h - y : rowAreas[index] / rowWidth;
    const tile = { ...item, x: rect.x, y, w: rowWidth, h: Math.max(0, h) };
    y += h;
    return tile;
  });
  return { positioned, remaining: { x: rect.x + rowWidth, y: rect.y, w: Math.max(0, rect.w - rowWidth), h: rect.h } };
}

function squarifiedTreemap(items: HeatmapTile[], rect: Rect): Positioned[] {
  const sorted = sortedValidTiles(items) as TreemapItem[];
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  const totalArea = rect.w * rect.h;
  if (!sorted.length || totalWeight <= 0 || totalArea <= 0) return [];

  const areaBySymbol = new Map(sorted.map((item) => [item.symbol, (item.weight / totalWeight) * totalArea]));
  const positioned: Positioned[] = [];
  let remaining = rect;
  let row: TreemapItem[] = [];
  let rowAreas: number[] = [];

  for (const item of sorted) {
    const area = areaBySymbol.get(item.symbol) ?? 0;
    const side = Math.min(remaining.w, remaining.h);
    if (!row.length || worstAspect([...rowAreas, area], side) <= worstAspect(rowAreas, side)) {
      row.push(item);
      rowAreas.push(area);
    } else {
      const laidOut = layoutRow(row, rowAreas, remaining);
      positioned.push(...laidOut.positioned);
      remaining = laidOut.remaining;
      row = [item];
      rowAreas = [area];
    }
  }

  if (row.length) positioned.push(...layoutRow(row, rowAreas, remaining).positioned);
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
      const rows = sortedValidTiles(tiles.filter((t) => (t.sector ?? "Other") === sector));
      return { sector, rows, weight: rows.reduce((sum, row) => sum + row.weight, 0) };
    }).filter((g) => g.rows.length);
    const groupRects = squarifiedTreemap(groups.map((g) => ({ symbol: g.sector, label: g.sector, value: 0, changePercent: 0, weight: g.weight })), { x: 0, y: 0, w: 100, h: 100 });
    return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{groupRects.map((rect) => {
      const group = groups.find((g) => g.sector === rect.symbol)!;
      const headerHeight = rect.h >= 8 ? 3.5 : 0;
      const inner = squarifiedTreemap(group.rows, { x: 0.25, y: headerHeight, w: 99.5, h: Math.max(0, 100 - headerHeight - 0.25) });
      return <div key={group.sector} className="absolute border border-black/50 bg-black/20" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}><div className="h-6 truncate px-2 text-[11px] font-bold uppercase tracking-wide text-white/75">{group.sector}</div>{inner.map((tile) => <TradingTile key={`${group.sector}-${tile.symbol}-${tile.label}`} tile={tile} />)}</div>;
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
