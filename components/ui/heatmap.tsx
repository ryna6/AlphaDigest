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
type WeightedItem<T> = T & { weight: number };

const MAX_ASPECT_RATIO = 1.5;
const sectorOrder = ["Technology", "Utilities", "Financials", "Health Care", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Communication Services", "Real Estate", "Other"];

function normalizedWeight(weight: number) {
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function worstAspect(row: number[], side: number) {
  if (!row.length || side <= 0) return Infinity;
  const sum = row.reduce((total, value) => total + value, 0);
  const min = Math.min(...row);
  const max = Math.max(...row);
  if (sum <= 0 || min <= 0) return Infinity;
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function layoutRow<T extends { area: number }>(row: T[], rect: Rect): Array<T & Rect> {
  const totalArea = row.reduce((sum, item) => sum + item.area, 0);
  if (totalArea <= 0 || rect.w <= 0 || rect.h <= 0) return [];

  if (rect.w >= rect.h) {
    const rowHeight = Math.min(rect.h, totalArea / rect.w);
    let x = rect.x;
    return row.map((item, index) => {
      const isLast = index === row.length - 1;
      const width = isLast ? rect.x + rect.w - x : item.area / rowHeight;
      const positioned = { ...item, x, y: rect.y, w: Math.max(0, width), h: rowHeight };
      x += width;
      return positioned;
    });
  }

  const rowWidth = Math.min(rect.w, totalArea / rect.h);
  let y = rect.y;
  return row.map((item, index) => {
    const isLast = index === row.length - 1;
    const height = isLast ? rect.y + rect.h - y : item.area / rowWidth;
    const positioned = { ...item, x: rect.x, y, w: rowWidth, h: Math.max(0, height) };
    y += height;
    return positioned;
  });
}

function remainingRect(rowArea: number, rect: Rect): Rect {
  if (rect.w >= rect.h) {
    const rowHeight = Math.min(rect.h, rowArea / rect.w);
    return { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: Math.max(0, rect.h - rowHeight) };
  }
  const rowWidth = Math.min(rect.w, rowArea / rect.h);
  return { x: rect.x + rowWidth, y: rect.y, w: Math.max(0, rect.w - rowWidth), h: rect.h };
}

function squarifiedLayout<T extends WeightedItem<object>>(items: T[], rect: Rect): Array<T & Rect> {
  const sorted = [...items].filter((item) => normalizedWeight(item.weight) > 0).sort((a, b) => normalizedWeight(b.weight) - normalizedWeight(a.weight));
  const totalWeight = sorted.reduce((sum, item) => sum + normalizedWeight(item.weight), 0);
  const totalArea = rect.w * rect.h;
  if (!sorted.length || totalWeight <= 0 || totalArea <= 0) return [];

  const scaled = sorted.map((item) => ({ ...item, area: (normalizedWeight(item.weight) / totalWeight) * totalArea }));
  const positioned: Array<(typeof scaled)[number] & Rect> = [];
  let available = { ...rect };
  let row: typeof scaled = [];
  let rowArea = 0;

  for (const item of scaled) {
    const side = Math.min(available.w, available.h);
    const currentWorst = worstAspect(row.map((r) => r.area), side);
    const nextWorst = worstAspect([...row, item].map((r) => r.area), side);
    if (row.length && nextWorst > currentWorst) {
      positioned.push(...layoutRow(row, available));
      available = remainingRect(rowArea, available);
      row = [item];
      rowArea = item.area;
    } else {
      row.push(item);
      rowArea += item.area;
    }
  }
  positioned.push(...layoutRow(row, available));
  return positioned.map(({ area: _area, ...item }) => item as T & Rect);
}

function fitWithinAspect(rect: Rect, maxRatio = MAX_ASPECT_RATIO): Rect {
  if (rect.w <= 0 || rect.h <= 0) return rect;
  const ratio = rect.w / rect.h;
  if (ratio > maxRatio) {
    const w = rect.h * maxRatio;
    return { x: rect.x + (rect.w - w) / 2, y: rect.y, w, h: rect.h };
  }
  if (1 / ratio > maxRatio) {
    const h = rect.w * maxRatio;
    return { x: rect.x, y: rect.y + (rect.h - h) / 2, w: rect.w, h };
  }
  return rect;
}

function paddedRect(rect: Rect, padding: number): Rect {
  return { x: rect.x + padding, y: rect.y + padding, w: Math.max(0, rect.w - padding * 2), h: Math.max(0, rect.h - padding * 2) };
}

function TradingTile({ tile }: { tile: Positioned }) {
  const showTicker = tile.w >= 6 && tile.h >= 6;
  const showChange = tile.w >= 9 && tile.h >= 10;
  const showLogo = tile.w >= 8 && tile.h >= 9 && tile.iconPath;
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
  const stockTiles = [...tiles].sort((a, b) => normalizedWeight(b.weight) - normalizedWeight(a.weight));

  if (grouping === "sector") {
    const groups = sectorOrder.map((sector) => {
      const rows = stockTiles.filter((t) => (t.sector ?? "Other") === sector);
      return { sector, rows, weight: rows.reduce((s, r) => s + normalizedWeight(r.weight), 0) };
    }).filter((g) => g.rows.length && g.weight > 0);
    const groupRects = squarifiedLayout(groups.map((g) => ({ symbol: g.sector, label: g.sector, value: 0, changePercent: 0, weight: g.weight })), { x: 0, y: 0, w: 100, h: 100 });
    return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{groupRects.map((rect) => {
      const group = groups.find((g) => g.sector === rect.symbol)!;
      const sectorRect = fitWithinAspect(paddedRect(rect, 0.2));
      const titleHeight = Math.min(7, Math.max(4, sectorRect.h * 0.13));
      const innerRect = { x: 1.2, y: titleHeight + 1, w: 97.6, h: Math.max(0, 98.4 - titleHeight) };
      const inner = squarifiedLayout(group.rows, innerRect).map((tile) => ({ ...tile, ...fitWithinAspect(tile) }));
      return <div key={group.sector} className="absolute overflow-hidden border border-black/60 bg-black/25" style={{ left: `${sectorRect.x}%`, top: `${sectorRect.y}%`, width: `${sectorRect.w}%`, height: `${sectorRect.h}%` }}><div className="flex items-center px-2 text-[11px] font-bold uppercase tracking-wide text-white/80" style={{ height: `${titleHeight}%` }}>{group.sector}</div><div className="absolute inset-0">{inner.map((tile) => <TradingTile key={`${group.sector}-${tile.symbol}-${tile.label}`} tile={tile} />)}</div></div>;
    })}</div>;
  }

  const positioned = squarifiedLayout(stockTiles, { x: 0, y: 0, w: 100, h: 100 }).map((tile) => ({ ...tile, ...fitWithinAspect(tile) }));
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
