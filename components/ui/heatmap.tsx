import type { HeatmapTile } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

function tileTone(change: number) {
  if (change > 0.8) return "bg-positive/35 border-positive/45";
  if (change > 0) return "bg-positive/18 border-positive/25";
  if (change < -0.8) return "bg-negative/35 border-negative/45";
  if (change < 0) return "bg-negative/18 border-negative/25";
  return "bg-panelHover border-border";
}

export function Heatmap({ tiles }: { tiles: HeatmapTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={`${tile.symbol}-${tile.label}`} className={cn("min-h-24 rounded-xl border p-3 transition hover:brightness-110", tileTone(tile.changePercent))} style={{ gridColumn: `span ${Math.min(2, Math.max(1, Math.round(tile.weight / 6)))}` }} title={`${tile.label}: ${tile.value}. Source: ${tile.source}. Last updated: ${tile.lastUpdated}`}>
          <div className="text-xs font-semibold text-primaryText">{tile.symbol}</div>
          <div className="mt-1 truncate text-[11px] text-secondaryText">{tile.label}</div>
          <div className="mt-3 text-sm font-semibold tabular-nums text-primaryText">{tile.value}</div>
          <div className={cn("text-xs tabular-nums", tile.changePercent < 0 ? "text-negative" : "text-positive")}>{tile.changePercent.toFixed(2)}%</div>
        </div>
      ))}
    </div>
  );
}
