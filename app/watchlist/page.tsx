import { DataTable } from "@/components/ui/data-table";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

const rows = [{ ticker: "AAPL", price: "$204.18", change: "+1.21%", status: "Mock cached" }, { ticker: "NVDA", price: "$145.20", change: "+2.10%", status: "Mock cached" }];
export default function WatchlistPage() {
  return <><PageTitle title="Watchlist" subtitle="MVP placeholder for tickers that should receive full cache coverage and richer ticker explorer hydration." /><Panel><SectionHeader title="Tracked symbols" /><DataTable columns={[{ key: "ticker", header: "Ticker" }, { key: "price", header: "Price", align: "right" }, { key: "change", header: "Change", align: "right" }, { key: "status", header: "Status" }]} rows={rows} /></Panel></>;
}
