import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
export default function WatchlistPage() { return <><PageTitle title="Watchlist" subtitle="Saved tickers for future cached refresh prioritization." /><Panel><EmptyState message="Watchlist add/remove UI is planned. MVP shows rate-limit-aware caching intent." /></Panel></>; }
