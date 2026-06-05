"use client";

import { useMemo, useState } from "react";
import { Heatmap } from "@/components/ui/heatmap";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { ErrorState } from "@/components/ui/error-state";
import { cryptoHeatmap, globalHeatmap, macroHeatmap, sectorHeatmap } from "@/lib/data/fixtures/dashboard";

const modes = ["Global Markets", "Sectors", "Crypto", "Macro"] as const;
type Mode = (typeof modes)[number];

const missingMessages: Record<Mode, string> = {
  "Global Markets": "Finnhub key missing for Global Markets Heatmap. Add FINNHUB_GLOBAL_MARKETS_API_KEY in Netlify environment variables.",
  Sectors: "Finnhub key missing for Sectors Heatmap. Add FINNHUB_SECTORS_HEATMAP_API_KEY in Netlify environment variables.",
  Crypto: "Crypto primarily uses CoinGecko. Add FINNHUB_CRYPTO_HEATMAP_API_KEY for Finnhub quote fallback.",
  Macro: "Finnhub key missing for Macro Heatmap. Add FINNHUB_MACRO_HEATMAP_API_KEY in Netlify environment variables.",
};

export function MarketsBoard() {
  const [mode, setMode] = useState<Mode>("Global Markets");
  const tiles = useMemo(() => ({
    "Global Markets": globalHeatmap,
    Sectors: sectorHeatmap,
    Crypto: cryptoHeatmap,
    Macro: macroHeatmap,
  })[mode], [mode]);

  return (
    <Panel>
      <SectionHeader title="Heatmap" subtitle="Tiles are mock fixtures until Netlify environment variables and live adapters are configured." />
      <div className="mb-4 flex flex-wrap gap-2">
        {modes.map((item) => (
          <button key={item} onClick={() => setMode(item)} className={`rounded-full border px-3 py-1 text-xs ${mode === item ? "border-accent bg-accent/10 text-accent" : "border-border text-mutedText hover:bg-panelHover"}`}>
            {item}
          </button>
        ))}
      </div>
      <ErrorState message={missingMessages[mode]} />
      <div className="mt-4"><Heatmap tiles={tiles} /></div>
    </Panel>
  );
}
