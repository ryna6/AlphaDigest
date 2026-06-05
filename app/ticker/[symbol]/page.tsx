import { TickerDetailView } from "@/components/dashboard/ticker/ticker-view";
export default function TickerPage({ params }: { params: { symbol: string } }) { return <TickerDetailView symbol={params.symbol.toUpperCase()} />; }
