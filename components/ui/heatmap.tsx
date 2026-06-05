import type { HeatmapTile } from "@/lib/data/schemas/common";
import { cn } from "@/lib/utils/cn";

function tileColor(change: number) {
  if (change > 1) return "bg-positive/35 border-positive/40";
  if (change > 0) return "bg-positive/18 border-positive/25";
  if (change < -1) return "bg-negative/35 border-negative/40";
  if (change < 0) return "bg-negative/18 border-negative/25";
  return "bg-panelHover border-borderStrong";
}

export function Heatmap({ tiles }: { tiles: HeatmapTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div key={`${tile.symbol}-${tile.label}`} className={`min-h-24 rounded-xl border p-3 ${tileColor(tile.changePercent)}`} title={`${tile.label}: ${tile.changePercent.toFixed(2)}%`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-textPrimary">{tile.label}</p>
              <p className="text-[11px] uppercase tracking-wide text-textMuted">{tile.symbol}</p>
            </div>
            <p className={cn("tabular text-sm font-semibold", tile.changePercent < 0 ? "text-negative" : tile.changePercent > 0 ? "text-positive" : "text-textPrimary")}>{tile.changePercent.toFixed(2)}%</p>
          </div>
        </div>
      ))}
    </div>
  );
}
