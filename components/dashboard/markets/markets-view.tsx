"use client";
import { useState } from "react";
import { marketsMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { Heatmap } from "@/components/ui/heatmap";
import { ErrorState } from "@/components/ui/error-state";

const data = marketsMock();
const modes = ["globalMarkets", "sectors", "crypto", "macro"] as const;
const labels = { globalMarkets: "Global Markets", sectors: "Sectors", crypto: "Crypto", macro: "Macro" };

export function MarketsView() {
  const [mode, setMode] = useState<(typeof modes)[number]>("globalMarkets");
  return <><PageTitle title="Markets" subtitle="What is moving across markets." /><Panel><SectionHeader title="Top Market Strip" /> <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">{data.strip.map((m) => <div key={m.label} className="rounded-xl border border-borderStrong bg-sidebar p-3"><MetricRow metric={m} /></div>)}</div></Panel><Panel className="mt-4"><SectionHeader title="Heatmap" subtitle="Tiles sized by logical asset weight; color shows percentage change." />{data.heatmapKeyMessages.length ? <div className="mb-3 grid gap-2">{data.heatmapKeyMessages.map((m) => <ErrorState key={m} message={m} />)}</div> : null}<div className="mb-4 flex flex-wrap gap-2">{modes.map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-full border px-3 py-1 text-xs ${mode === m ? "border-accentBlue bg-accentBlue/10 text-accentBlue" : "border-borderStrong text-textMuted"}`}>{labels[m]}</button>)}</div><Heatmap tiles={data.heatmaps[mode]} /></Panel><div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionHeader title="Market Breadth" />{data.breadth.map((m) => <MetricRow key={m.label} metric={m} />)}</Panel><Panel><SectionHeader title="Movers / Leaders / Laggards" />{data.movers.map((m) => <MetricRow key={m.label} metric={m} />)}</Panel></div></>;
}
