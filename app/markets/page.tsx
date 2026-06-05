import { MarketsBoard } from "@/components/dashboard/markets/markets-board";
import { DataTable } from "@/components/ui/data-table";
import { MetricRow } from "@/components/ui/metric-row";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { keyMarketStats } from "@/lib/data/fixtures/dashboard";

export default function MarketsPage() {
  return <div className="space-y-4"><div><h1 className="text-2xl font-semibold">What is moving across markets?</h1><p className="text-sm text-mutedText">Visual cross-asset dashboard with heatmap-specific Finnhub key strategy.</p></div><Panel><SectionHeader title="Top Market Strip" /> <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">{keyMarketStats.slice(0,8).map((m)=><MetricRow key={m.label} metric={m}/>)}</div></Panel><MarketsBoard/><div className="grid gap-4 xl:grid-cols-2"><Panel><SectionHeader title="Market Breadth" subtitle="Participation, advancers/decliners, moving-average participation, highs/lows."/><DataTable columns={[{key:"metric",label:"Metric"},{key:"value",label:"Value",align:"right"},{key:"status",label:"Status"}]} rows={[{metric:"Participation",value:"Neutral",status:"Mock"},{metric:"Advancers / Decliners",value:"58% / 42%",status:"Delayed"},{metric:"Above 50D MA",value:"54%",status:"Mock"},{metric:"New highs / lows",value:"112 / 41",status:"Mock"}]} /></Panel><Panel><SectionHeader title="Movers / Leaders / Laggards"/><DataTable columns={[{key:"ticker",label:"Ticker"},{key:"group",label:"Group"},{key:"change",label:"Change",align:"right"}]} rows={[{ticker:"NVDA",group:"Leader",change:"+2.4%"},{ticker:"XLE",group:"Sector",change:"+1.1%"},{ticker:"IWM",group:"Laggard",change:"-0.2%"}]} /></Panel></div></div>;
}
