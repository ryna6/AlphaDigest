import { AllEarningsView } from "@/components/dashboard/news-calendar/news-calendar-view";
import { getNewsCalendarPayload } from "@/lib/data/live-dashboard";

export const dynamic = "force-dynamic";

export default async function AllEarningsPage() {
  const { payload } = await getNewsCalendarPayload();
  return <AllEarningsView data={payload} />;
}
