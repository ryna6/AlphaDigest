"use client";

import Image from "next/image";
import type { HeatmapTile } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

const MAX_ASPECT_RATIO = 1.5;
const SECTOR_HEADER_PERCENT = 5.25;
const SECTOR_INNER_GAP_PERCENT = 0.45;

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
type WeightedItem<T> = T & { weight: number };
type Positioned = HeatmapTile & Rect;

function safeWeight(weight: number) {
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

function worstAspectRatio(row: number[], side: number) {
  const sum = row.reduce((total, value) => total + value, 0);
  const min = Math.min(...row);
  const max = Math.max(...row);
  if (sum <= 0 || min <= 0 || side <= 0) return Number.POSITIVE_INFINITY;
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function placeRow<T extends WeightedItem<unknown>>(items: T[], areas: number[], rect: Rect): Array<T & Rect> {
  const rowArea = areas.reduce((total, area) => total + area, 0);
  if (rowArea <= 0 || rect.w <= 0 || rect.h <= 0) return [];
  const horizontal = rect.w >= rect.h;
  if (horizontal) {
    const rowHeight = rowArea / rect.w;
    let x = rect.x;
    return items.map((item, index) => {
      const width = areas[index] / rowHeight;
      const positioned = { ...item, x, y: rect.y, w: width, h: rowHeight };
      x += width;
      return positioned;
    });
  }
  const rowWidth = rowArea / rect.h;
  let y = rect.y;
  return items.map((item, index) => {
    const height = areas[index] / rowWidth;
    const positioned = { ...item, x: rect.x, y, w: rowWidth, h: height };
    y += height;
    return positioned;
  });
}

function shrinkRect(rect: Rect, rowArea: number): Rect {
  if (rect.w >= rect.h) {
    const rowHeight = rowArea / rect.w;
    return { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: Math.max(0, rect.h - rowHeight) };
  }
  const rowWidth = rowArea / rect.h;
  return { x: rect.x + rowWidth, y: rect.y, w: Math.max(0, rect.w - rowWidth), h: rect.h };
}

function squarifiedLayout<T extends WeightedItem<unknown>>(items: T[], rect: Rect): Array<T & Rect> {
  const sorted = [...items].filter((item) => safeWeight(item.weight) > 0).sort((a, b) => safeWeight(b.weight) - safeWeight(a.weight));
  const totalWeight = sorted.reduce((total, item) => total + safeWeight(item.weight), 0);
  const totalArea = rect.w * rect.h;
  if (!sorted.length || totalWeight <= 0 || totalArea <= 0) return [];

  const remaining = sorted.map((item) => ({ item, area: (safeWeight(item.weight) / totalWeight) * totalArea }));
  const positioned: Array<T & Rect> = [];
  let currentRect = rect;

  while (remaining.length && currentRect.w > 0 && currentRect.h > 0) {
    const row: T[] = [];
    const rowAreas: number[] = [];
    const side = Math.min(currentRect.w, currentRect.h);

    while (remaining.length) {
      const next = remaining[0];
      if (!row.length) {
        row.push(next.item);
        rowAreas.push(next.area);
        remaining.shift();
        continue;
      }
      const currentWorst = worstAspectRatio(rowAreas, side);
      const nextWorst = worstAspectRatio([...rowAreas, next.area], side);
      if (nextWorst <= currentWorst || currentWorst > MAX_ASPECT_RATIO) {
        row.push(next.item);
        rowAreas.push(next.area);
        remaining.shift();
      } else {
        break;
      }
    }

    positioned.push(...placeRow(row, rowAreas, currentRect));
    currentRect = shrinkRect(currentRect, rowAreas.reduce((total, area) => total + area, 0));
  }

  return positioned;
}

const sectorOrder = ["Technology", "Utilities", "Financials", "Health Care", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Communication Services", "Real Estate", "Other"];

function TradingTile({ tile }: { tile: Positioned }) {
  const showTicker = tile.w >= 4.2 && tile.h >= 4.8;
  const showChange = tile.w >= 6.2 && tile.h >= 7.2;
  const showLogo = tile.w >= 7 && tile.h >= 8 && tile.iconPath;
  return (
    <div className="absolute overflow-hidden border p-1 shadow-[inset_0_0_24px_rgba(0,0,0,0.18)] transition hover:z-10 hover:brightness-110" style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.w}%`, height: `${tile.h}%`, ...colorStyle(tile.changePercent) }} title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}>
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        {showLogo ? <Image src={tile.iconPath!} alt={`${tile.symbol} logo`} width={28} height={28} className="h-7 w-7 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
        {showTicker ? <div className="max-w-full truncate text-sm font-black text-white drop-shadow md:text-base">{tile.symbol}</div> : null}
        {showChange ? <div className="text-[11px] font-bold text-white/90 md:text-xs">{tile.changePercent >= 0 ? "+" : ""}{tile.changePercent.toFixed(2)}%</div> : null}
      </div>
    </div>
  );
}

function TradingViewHeatmap({ tiles, grouping }: { tiles: HeatmapTile[]; grouping: "none" | "sector" }) {
  const sortedTiles = [...tiles].sort((a, b) => safeWeight(b.weight) - safeWeight(a.weight));

  if (grouping === "sector") {
    const groups = sectorOrder.map((sector) => {
      const rows = sortedTiles.filter((t) => (t.sector ?? "Other") === sector);
      return { sector, rows, weight: rows.reduce((s, r) => s + safeWeight(r.weight), 0), value: 0, changePercent: 0, symbol: sector, label: sector };
    }).filter((g) => g.rows.length && g.weight > 0);
    const groupRects = squarifiedLayout(groups, { x: 0, y: 0, w: 100, h: 100 });
    return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{groupRects.map((rect) => {
      const innerRect = { x: SECTOR_INNER_GAP_PERCENT, y: SECTOR_HEADER_PERCENT, w: Math.max(0, 100 - SECTOR_INNER_GAP_PERCENT * 2), h: Math.max(0, 100 - SECTOR_HEADER_PERCENT - SECTOR_INNER_GAP_PERCENT) };
      const inner = squarifiedLayout(rect.rows, innerRect);
      return <div key={rect.sector} className="absolute overflow-hidden border border-black/70 bg-black/20" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}><div className="absolute left-0 right-0 top-0 z-10 flex h-[5.25%] min-h-5 items-center truncate border-b border-white/10 bg-black/25 px-2 text-[11px] font-bold uppercase tracking-wide text-white/80">{rect.sector}</div>{inner.map((tile) => <TradingTile key={`${rect.sector}-${tile.symbol}-${tile.label}`} tile={tile} />)}</div>;
    })}</div>;
  }

  const positioned = squarifiedLayout(sortedTiles, { x: 0, y: 0, w: 100, h: 100 });
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
