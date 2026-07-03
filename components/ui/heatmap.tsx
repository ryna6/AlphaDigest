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
type WeightedTile = HeatmapTile & { scaledWeight: number };

const sectorOrder = ["Technology", "Utilities", "Financials", "Health Care", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Communication Services", "Real Estate", "Other"];
const gap = 0.15;

function worstRatio(row: WeightedTile[], side: number) {
  if (!row.length || side <= 0) return Infinity;
  const sum = row.reduce((total, item) => total + item.scaledWeight, 0);
  const max = Math.max(...row.map((item) => item.scaledWeight));
  const min = Math.min(...row.map((item) => item.scaledWeight));
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

function layoutRow(row: WeightedTile[], rect: Rect): { positioned: Positioned[]; remaining: Rect } {
  const rowArea = row.reduce((total, item) => total + item.scaledWeight, 0);
  if (rect.w <= rect.h) {
    const rowWidth = rowArea / rect.h;
    let y = rect.y;
    return {
      positioned: row.map((item) => {
        const h = item.scaledWeight / rowWidth;
        const positioned = insetRect({ ...item, x: rect.x, y, w: rowWidth, h });
        y += h;
        return positioned;
      }),
      remaining: { x: rect.x + rowWidth, y: rect.y, w: Math.max(0, rect.w - rowWidth), h: rect.h }
    };
  }
  const rowHeight = rowArea / rect.w;
  let x = rect.x;
  return {
    positioned: row.map((item) => {
      const w = item.scaledWeight / rowHeight;
      const positioned = insetRect({ ...item, x, y: rect.y, w, h: rowHeight });
      x += w;
      return positioned;
    }),
    remaining: { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: Math.max(0, rect.h - rowHeight) }
  };
}

function insetRect<T extends Positioned>(tile: T): T {
  const insetX = Math.min(gap, tile.w / 4);
  const insetY = Math.min(gap, tile.h / 4);
  return { ...tile, x: tile.x + insetX, y: tile.y + insetY, w: Math.max(0, tile.w - insetX * 2), h: Math.max(0, tile.h - insetY * 2) };
}

function squarify(items: HeatmapTile[], rect: Rect): Positioned[] {
  const valid = [...items]
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const total = valid.reduce((sum, item) => sum + item.weight, 0);
  if (!valid.length || total <= 0 || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const remainingItems: WeightedTile[] = valid.map((item) => ({ ...item, scaledWeight: item.weight * scale }));
  const positioned: Positioned[] = [];
  let remainingRect = rect;
  let row: WeightedTile[] = [];

  while (remainingItems.length) {
    const item = remainingItems[0];
    const side = Math.min(remainingRect.w, remainingRect.h);
    if (!row.length || worstRatio([...row, item], side) <= worstRatio(row, side)) {
      row.push(remainingItems.shift()!);
    } else {
      const laidOut = layoutRow(row, remainingRect);
      positioned.push(...laidOut.positioned);
      remainingRect = laidOut.remaining;
      row = [];
    }
  }
  if (row.length) positioned.push(...layoutRow(row, remainingRect).positioned);
  return positioned;
}

function TradingTile({ tile }: { tile: Positioned }) {
  const showTicker = tile.w >= 3.8 && tile.h >= 4.8;
  const showChange = tile.w >= 5.5 && tile.h >= 8;
  const showLogo = tile.w >= 4.2 && tile.h >= 6.5 && tile.iconPath;
  const logoSize = tile.w >= 10 && tile.h >= 12 ? 28 : 20;
  return (
    <div className="absolute overflow-hidden border p-1 shadow-[inset_0_0_24px_rgba(0,0,0,0.18)] transition hover:z-10 hover:brightness-110" style={{ left: `${tile.x}%`, top: `${tile.y}%`, width: `${tile.w}%`, height: `${tile.h}%`, ...colorStyle(tile.changePercent) }} title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}>
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        {showLogo ? <Image src={tile.iconPath!} alt={`${tile.symbol} logo`} width={logoSize} height={logoSize} className="rounded-full object-cover" style={{ width: logoSize, height: logoSize }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
        {showTicker ? <div className={cn("max-w-full truncate font-black text-white drop-shadow", tile.w >= 8 && tile.h >= 9 ? "text-sm" : "text-[10px]")}>{tile.symbol}</div> : null}
        {showChange ? <div className="text-[11px] font-bold text-white/90">{tile.changePercent >= 0 ? "+" : ""}{tile.changePercent.toFixed(2)}%</div> : null}
      </div>
    </div>
  );
}

function TradingViewHeatmap({ tiles, grouping }: { tiles: HeatmapTile[]; grouping: "none" | "sector" }) {
  if (grouping === "sector") {
    const groups = sectorOrder.map((sector) => {
      const rows = tiles.filter((t) => (t.sector ?? "Other") === sector).sort((a, b) => b.weight - a.weight);
      return { sector, rows, weight: rows.reduce((s, r) => s + r.weight, 0) };
    }).filter((g) => g.rows.length && g.weight > 0);
    const groupRects = squarify(groups.map((g) => ({ symbol: g.sector, label: g.sector, value: 0, changePercent: 0, weight: g.weight })), { x: 0, y: 0, w: 100, h: 100 });
    return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{groupRects.map((rect) => {
      const group = groups.find((g) => g.sector === rect.symbol)!;
      const headerHeight = Math.min(4, Math.max(2.8, rect.h * 0.12));
      const inner = squarify(group.rows, { x: rect.x + 0.2, y: rect.y + headerHeight, w: Math.max(0, rect.w - 0.4), h: Math.max(0, rect.h - headerHeight - 0.2) });
      return <div key={group.sector} className="absolute overflow-hidden border border-black/60 bg-black/20" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}><div className="truncate px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-white/75" style={{ height: `${headerHeight}%` }}>{group.sector}</div>{inner.map((tile) => <TradingTile key={`${group.sector}-${tile.symbol}`} tile={tile} />)}</div>;
    })}</div>;
  }
  const positioned = squarify(tiles, { x: 0, y: 0, w: 100, h: 100 });
  return <div className="relative h-[32rem] overflow-hidden border border-borderStrong bg-[#0b1120] md:h-[38rem]">{positioned.map((tile) => <TradingTile key={tile.symbol} tile={tile} />)}</div>;
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
