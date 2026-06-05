import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

export default function WatchlistPage(){return <div className="space-y-4"><h1 className="text-2xl font-semibold">Watchlist</h1><Panel><SectionHeader title="Placeholder Watchlist" subtitle="Persistence will be added with Supabase in a future phase."/><DataTable columns={[{key:"ticker",label:"Ticker"},{key:"price",label:"Price",align:"right"},{key:"change",label:"Change",align:"right"},{key:"note",label:"Note"}]} rows={[{ticker:"SPY",price:"$615.20",change:"+0.3%",note:"Index ETF"},{ticker:"NVDA",price:"$128.40",change:"+2.4%",note:"AI leader"}]}/></Panel></div>}
