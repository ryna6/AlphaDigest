import { MarketsView } from "@/components/dashboard/markets/markets-view";
import { getMarketsPayload } from "@/lib/data/live-dashboard";

export const dynamic = "force-dynamic";

export default async function MarketsPage() { const { payload } = await getMarketsPayload(); return <MarketsView data={payload} />; }
