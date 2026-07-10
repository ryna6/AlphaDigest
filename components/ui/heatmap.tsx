"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { HeatmapTile } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

function colorStyle(change: number) {
  const clamped = Math.max(-5, Math.min(5, change));
  const intensity = Math.min(1, Math.abs(clamped) / 3);

  if (clamped > 0) {
    return {
      backgroundColor: `rgb(${18 - intensity * 10}, ${74 + intensity * 88}, ${50 + intensity * 26})`,
      borderColor: `rgba(34,197,94,${0.35 + intensity * 0.45})`
    };
  }

  if (clamped < 0) {
    return {
      backgroundColor: `rgb(${74 + intensity * 66}, ${32 - intensity * 6}, ${37 - intensity * 8})`,
      borderColor: `rgba(239,68,68,${0.35 + intensity * 0.45})`
    };
  }

  return {
    backgroundColor: "rgba(51,65,85,0.75)",
    borderColor: "rgba(100,116,139,0.55)"
  };
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

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Positioned = HeatmapTile & Rect;

type Size = {
  width: number;
  height: number;
};

const SECTOR_TITLE_HEIGHT = 28;
const MIN_RENDERABLE_SIZE = 1;

const sectorOrder = [
  "Technology",
  "Utilities",
  "Financials",
  "Health Care",
  "Energy",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Materials",
  "Communication Services",
  "Real Estate",
  "Other"
];

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);

      setSize((previous) => {
        if (previous.width === width && previous.height === height) return previous;
        return { width, height };
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, size] as const;
}

function totalWeight(items: HeatmapTile[]) {
  return items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
}

function findBalancedSplit(items: HeatmapTile[]) {
  const total = totalWeight(items);
  const half = total / 2;

  let running = 0;
  let bestIndex = 1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 1; i < items.length; i += 1) {
    running += Math.max(0, items[i - 1].weight);
    const distance = Math.abs(half - running);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function binaryTreemapLayout(items: HeatmapTile[], rect: Rect): Positioned[] {
  const clean = items
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (!clean.length || rect.w <= 0 || rect.h <= 0) return [];

  function layoutRecursive(nodes: HeatmapTile[], area: Rect): Positioned[] {
    if (!nodes.length || area.w <= 0 || area.h <= 0) return [];

    if (nodes.length === 1) {
      return [
        {
          ...nodes[0],
          x: area.x,
          y: area.y,
          w: Math.max(MIN_RENDERABLE_SIZE, area.w),
          h: Math.max(MIN_RENDERABLE_SIZE, area.h)
        }
      ];
    }

    const splitIndex = findBalancedSplit(nodes);
    const first = nodes.slice(0, splitIndex);
    const second = nodes.slice(splitIndex);

    const firstWeight = totalWeight(first);
    const secondWeight = totalWeight(second);
    const combinedWeight = firstWeight + secondWeight;

    if (combinedWeight <= 0 || !first.length || !second.length) {
      return nodes.map((node) => ({
        ...node,
        x: area.x,
        y: area.y,
        w: area.w,
        h: area.h
      }));
    }

    if (area.w >= area.h) {
      const firstWidth = area.w * (firstWeight / combinedWeight);
      const secondWidth = area.w - firstWidth;

      return [
        ...layoutRecursive(first, {
          x: area.x,
          y: area.y,
          w: firstWidth,
          h: area.h
        }),
        ...layoutRecursive(second, {
          x: area.x + firstWidth,
          y: area.y,
          w: secondWidth,
          h: area.h
        })
      ];
    }

    const firstHeight = area.h * (firstWeight / combinedWeight);
    const secondHeight = area.h - firstHeight;

    return [
      ...layoutRecursive(first, {
        x: area.x,
        y: area.y,
        w: area.w,
        h: firstHeight
      }),
      ...layoutRecursive(second, {
        x: area.x,
        y: area.y + firstHeight,
        w: area.w,
        h: secondHeight
      })
    ];
  }

  return layoutRecursive(clean, rect);
}

const tradingTextTiers = [
  { minWidth: 72, minHeight: 58, ticker: "text-[18px]", change: "text-[13px]", showChange: true },
  { minWidth: 52, minHeight: 42, ticker: "text-[16px]", change: "text-[11px]", showChange: true },
  { minWidth: 42, minHeight: 34, ticker: "text-xs", change: "text-[9px]", showChange: true },
  { minWidth: 30, minHeight: 26, ticker: "text-[11px]", change: "text-[8px]", showChange: false },
  { minWidth: 26, minHeight: 22, ticker: "text-[10px]", change: "text-[8px]", showChange: false }
];

function tradingTextTier(tile: Positioned) {
  const baseIndex = tradingTextTiers.findIndex(
    (tier) => tile.w >= tier.minWidth && tile.h >= tier.minHeight
  );
  if (baseIndex === -1) return null;

  const adjustedIndex = !tile.aggregate && tile.symbol.length === 4
    ? Math.min(baseIndex + 1, tradingTextTiers.length - 1)
    : baseIndex;

  return tradingTextTiers[adjustedIndex];
}

function TradingTile({ tile, onSelect }: { tile: Positioned; onSelect?: (tile: HeatmapTile) => void }) {
  const textTier = tradingTextTier(tile);
  const showTicker = Boolean(textTier);
  const showChange = Boolean(textTier?.showChange);
  const showLogo = tile.w >= 74 && tile.h >= 70 && tile.iconPath && !tile.aggregate;

  const interactive = onSelect && !tile.aggregate;
  const Element = interactive ? "button" : "div";
  return (
    <Element
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onSelect(tile) : undefined}
      className="absolute overflow-hidden border p-1 text-left shadow-[inset_0_0_24px_rgba(0,0,0,0.18)] transition duration-200 hover:z-10 hover:-translate-y-0.5 hover:brightness-110"
      style={{
        left: tile.x,
        top: tile.y,
        width: tile.w,
        height: tile.h,
        ...colorStyle(tile.changePercent)
      }}
      title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}
    >
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        {showLogo ? (
          <Image
            src={tile.iconPath!}
            alt={`${tile.symbol} logo`}
            width={24}
            height={24}
            className="h-6 w-6 rounded-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}

        {showTicker ? (
          <div className={cn("max-w-full truncate font-black leading-none text-white drop-shadow", textTier?.ticker)}>
            {tile.aggregate ? tile.label : tile.symbol}
          </div>
        ) : null}

        {showChange ? (
          <div className={cn("font-bold leading-none text-white/90", textTier?.change)}>
            {tile.changePercent >= 0 ? "+" : ""}
            {tile.changePercent.toFixed(2)}%
          </div>
        ) : null}
      </div>
    </Element>
  );
}

function TradingViewHeatmap({ tiles, grouping, onSelect }: { tiles: HeatmapTile[]; grouping: "none" | "sector"; onSelect?: (tile: HeatmapTile) => void }) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const hasSize = size.width > 0 && size.height > 0;

  if (grouping === "sector") {
    const groups = sectorOrder
      .map((sector) => {
        const rows = tiles
          .filter((tile) => (tile.sector ?? "Other") === sector)
          .sort((a, b) => b.weight - a.weight);

        return {
          sector,
          rows,
          weight: rows.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
        };
      })
      .filter((group) => group.rows.length && group.weight > 0);

    const groupRects = hasSize
      ? binaryTreemapLayout(
          groups.map((group) => ({
            symbol: group.sector,
            label: group.sector,
            value: 0,
            changePercent: 0,
            weight: group.weight
          })),
          {
            x: 0,
            y: 0,
            w: size.width,
            h: size.height
          }
        )
      : [];

    return (
      <div
        ref={containerRef}
        className="relative h-[32rem] overflow-hidden border border-borderStrong bg-panel md:h-[38rem]"
      >
        {groupRects.map((rect) => {
          const group = groups.find((item) => item.sector === rect.symbol);
          if (!group) return null;

          const innerHeight = Math.max(0, rect.h - SECTOR_TITLE_HEIGHT);

          const inner = binaryTreemapLayout(group.rows, {
            x: 0,
            y: 0,
            w: rect.w,
            h: innerHeight
          });

          return (
            <div
              key={group.sector}
              className="absolute flex flex-col overflow-hidden border border-black/70 bg-black/25"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h
              }}
            >
              <div className="relative z-20 flex h-7 shrink-0 items-center border-b border-black/60 bg-black/55 px-2 text-[11px] font-bold uppercase tracking-wide text-white/90">
                <span className="truncate">{group.sector}</span>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {inner.map((tile) => (
                  <TradingTile
                    key={`${group.sector}-${tile.symbol}-${tile.label}`}
                    tile={tile}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const positioned = hasSize
    ? binaryTreemapLayout(tiles, {
        x: 0,
        y: 0,
        w: size.width,
        h: size.height
      })
    : [];

  return (
    <div
      ref={containerRef}
      className="relative h-[32rem] overflow-hidden border border-borderStrong bg-panel md:h-[38rem]"
    >
      {positioned.map((tile) => (
        <TradingTile key={`${tile.symbol}-${tile.label}`} tile={tile} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function Heatmap({
  tiles,
  variant = "grid",
  grouping = "none",
  onSelect
}: {
  tiles: HeatmapTile[];
  variant?: "grid" | "trading";
  grouping?: "none" | "sector";
  onSelect?: (tile: HeatmapTile) => void;
}) {
  if (variant === "trading") return <TradingViewHeatmap tiles={tiles} grouping={grouping} onSelect={onSelect} />;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => {
        const interactive = Boolean(onSelect && !tile.aggregate);
        const Element = interactive ? "button" : "div";
        return (
        <Element
          type={interactive ? "button" : undefined}
          onClick={interactive ? () => onSelect?.(tile) : undefined}
          key={`${tile.symbol}-${tile.label}`}
          className={`min-h-28 border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:brightness-110 ${tileColor(tile.changePercent)}`}
          title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}
        >
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {tile.iconPath ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent">
                  <Image
                    src={tile.iconPath}
                    alt={`${tile.label} icon`}
                    width={32}
                    height={32}
                    className="h-full w-full rounded-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </span>
              ) : null}

              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-textPrimary">{tile.label}</p>
                <p className="text-xs uppercase tracking-wide text-white/65">{tile.symbol}</p>
              </div>
            </div>

            <p className={cn("shrink-0 text-right tabular text-xl font-bold leading-none", changeTextColor(tile.changePercent))}>
              {tile.changePercent.toFixed(2)}%
            </p>
          </div>
        </Element>
      )})}
    </div>
  );
}
