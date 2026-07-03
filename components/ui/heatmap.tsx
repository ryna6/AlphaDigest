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

type TreemapInput = Pick<HeatmapTile, "weight">;
const MIN_VISIBLE_PERCENT = 0.35;
const SECTOR_HEADER_PERCENT = 4.2;

function sortedByMarketCap<T extends TreemapInput>(items: T[]) {
  return [...items].filter((item) => item.weight > 0).sort((a, b) => b.weight - a.weight);
}

function worstAspect(row: number[], side: number) {
  if (!row.length || side <= 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((total, value) => total + value, 0);
  const min = Math.min(...row);
  const max = Math.max(...row);
  if (min <= 0 || sum <= 0) return Number.POSITIVE_INFINITY;
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
}

function layoutRow<T extends HeatmapTile & { area: number }>(row: T[], rect: Rect): Array<T & Rect> {
  const rowArea = row.reduce((sum, item) => sum + item.area, 0);
  if (rowArea <= 0) return [];

  if (rect.w >= rect.h) {
    const h = Math.min(rect.h, rowArea / rect.w);
    let x = rect.x;
    return row.map((item, index) => {
      const isLast = index === row.length - 1;
      const w = isLast ? rect.x + rect.w - x : item.area / h;
      const positioned = { ...item, x, y: rect.y, w, h };
      x += w;
      return positioned;
    });
  }

  const w = Math.min(rect.w, rowArea / rect.h);
  let y = rect.y;
  return row.map((item, index) => {
    const isLast = index === row.length - 1;
    const h = isLast ? rect.y + rect.h - y : item.area / w;
    const positioned = { ...item, x: rect.x, y, w, h };
    y += h;
    return positioned;
  });
}

function squarifiedLayout<T extends HeatmapTile>(items: T[], rect: Rect): Array<T & Rect> {
  const sorted = sortedByMarketCap(items);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  const totalArea = rect.w * rect.h;
  if (!sorted.length || totalWeight <= 0 || totalArea <= 0) return [];

  const remaining = sorted.map((item) => ({ ...item, area: (item.weight / totalWeight) * totalArea }));
  const positioned: Array<T & Rect & { area: number }> = [];
  let currentRect = { ...rect };
  let row: Array<T & { area: number }> = [];

  while (remaining.length) {
    const next = remaining[0];
    const side = Math.min(currentRect.w, currentRect.h);
    const rowAreas = row.map((item) => item.area);
    const currentWorst = worstAspect(rowAreas, side);
    const nextWorst = worstAspect([...rowAreas, next.area], side);

    if (!row.length || nextWorst <= currentWorst) {
      row.push(remaining.shift()!);
      continue;
    }

    const laidOut = layoutRow(row, currentRect);
    positioned.push(...laidOut);
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    if (currentRect.w >= currentRect.h) {
      const h = rowArea / currentRect.w;
      currentRect = { x: currentRect.x, y: currentRect.y + h, w: currentRect.w, h: Math.max(0, currentRect.h - h) };
    } else {
      const w = rowArea / currentRect.h;
      currentRect = { x: currentRect.x + w, y: currentRect.y, w: Math.max(0, currentRect.w - w), h: currentRect.h };
    }
    row = [];
  }

  positioned.push(...layoutRow(row, currentRect));
  return positioned.map(({ area: _area, ...item }) => item as T & Rect);
}

function readableRect<T extends Rect>(rect: T): T {
  if (rect.w <= 0 || rect.h <= 0) return rect;
  return { ...rect, w: Math.max(rect.w, MIN_VISIBLE_PERCENT), h: Math.max(rect.h, MIN_VISIBLE_PERCENT) };
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
  const containerClass = "relative aspect-square w-full overflow-hidden border border-borderStrong bg-[#0b1120] lg:max-h-[44rem]";

  if (grouping === "sector") {
    const groups = sectorOrder
      .map((sector) => {
        const rows = sortedByMarketCap(tiles.filter((tile) => (tile.sector ?? "Other") === sector));
        return { sector, rows, weight: rows.reduce((sum, row) => sum + row.weight, 0) };
      })
      .filter((group) => group.rows.length);
    const groupRects = squarifiedLayout(
      groups.map((group) => ({ symbol: group.sector, label: group.sector, value: 0, changePercent: 0, weight: group.weight })),
      { x: 0, y: 0, w: 100, h: 100 }
    );

    return (
      <div className={containerClass}>
        {groupRects.map((rect) => {
          const group = groups.find((candidate) => candidate.sector === rect.symbol)!;
          const header = Math.min(SECTOR_HEADER_PERCENT, Math.max(2.8, rect.h * 0.18));
          const innerRect = { x: 0.4, y: header, w: 99.2, h: Math.max(0, 100 - header - 0.4) };
          const inner = squarifiedLayout(group.rows, innerRect).map(readableRect);
          return (
            <div key={group.sector} className="absolute overflow-hidden border border-black/60 bg-black/25" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}>
              <div className="flex items-center truncate px-2 text-[11px] font-bold uppercase tracking-wide text-white/80" style={{ height: `${header}%` }}>
                {group.sector}
              </div>
              {inner.map((tile) => <TradingTile key={`${group.sector}-${tile.symbol}-${tile.label}`} tile={tile} />)}
            </div>
          );
        })}
      </div>
    );
  }

  const positioned = squarifiedLayout(sortedByMarketCap(tiles), { x: 0, y: 0, w: 100, h: 100 }).map(readableRect);
  return <div className={containerClass}>{positioned.map((tile) => <TradingTile key={`${tile.symbol}-${tile.label}`} tile={tile} />)}</div>;
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
