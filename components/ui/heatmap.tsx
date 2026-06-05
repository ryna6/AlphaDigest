import type { HeatmapTile } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

function tone(change: number) {
  if (change > 0.75) return "bg-positive/35 border-positive/50";
  if (change > 0) return "bg-positive/18 border-positive/30";
  if (change < -0.75) return "bg-negative/35 border-negative/50";
  if (change < 0) return "bg-negative/18 border-negative/30";
  return "bg-neutral/10 border-neutral/30";
}

export function Heatmap({ tiles }: { tiles: HeatmapTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.ticker} className={cn("min-h-24 rounded-xl border p-3 transition hover:scale-[1.01]", tone(tile.changePercent))} style={{ gridColumn: tile.weight > 12 ? "span 2" : undefined }} title={`${tile.source} · ${tile.lastUpdated}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-primaryText">{tile.ticker}</span>
            <span className={cn("font-mono text-xs", tile.changePercent >= 0 ? "text-positive" : "text-negative")}>{tile.changePercent.toFixed(2)}%</span>
          </div>
          <p className="mt-2 text-xs text-secondaryText">{tile.label}</p>
          <p className="mt-1 text-[11px] text-mutedText">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
