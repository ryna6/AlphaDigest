"use client";

import Image from "next/image";
import type { HeatmapTile } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

function tileColor(change: number) {
  if (change >= 1)
    return "border-[#16A34A]/70 bg-[#116C3A] shadow-[inset_0_0_28px_rgba(34,197,94,0.16)]";
  if (change > 0)
    return "border-[#22C55E]/45 bg-[#174B32] shadow-[inset_0_0_24px_rgba(34,197,94,0.10)]";
  if (change <= -1)
    return "border-[#DC2626]/70 bg-[#6F1D1D] shadow-[inset_0_0_28px_rgba(239,68,68,0.16)]";
  if (change < 0)
    return "border-[#EF4444]/45 bg-[#4A2025] shadow-[inset_0_0_24px_rgba(239,68,68,0.10)]";
  return "border-slate-500/50 bg-slate-700/55";
}

function changeTextColor(change: number) {
  if (change > 0) return "text-emerald-100";
  if (change < 0) return "text-red-100";
  return "text-slate-100";
}

export function Heatmap({ tiles }: { tiles: HeatmapTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={`${tile.symbol}-${tile.label}`}
          className={`min-h-28 border p-3 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 ${tileColor(tile.changePercent)}`}
          title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}
        >
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {tile.iconPath ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
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
                <p className="truncate text-sm font-semibold text-textPrimary">{tile.label}</p>
                <p className="text-[11px] uppercase tracking-wide text-white/65">{tile.symbol}</p>
              </div>
            </div>
            <p
              className={cn(
                "shrink-0 text-right tabular text-xl font-bold leading-none",
                changeTextColor(tile.changePercent)
              )}
            >
              {tile.changePercent.toFixed(2)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
