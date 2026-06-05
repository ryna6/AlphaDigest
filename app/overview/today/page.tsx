import { TodayView } from "@/components/dashboard/today/today-view";
import { getTodayPayload } from "@/lib/data/live-dashboard";

export const dynamic = "force-dynamic";

export default async function TodayPage() { const { payload } = await getTodayPayload(); return <TodayView data={payload} />; }
