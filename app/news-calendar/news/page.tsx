import { AllNewsView } from "@/components/dashboard/news-calendar/news-calendar-view";
import { getNewsCalendarPayload } from "@/lib/data/live-dashboard";

export const dynamic = "force-dynamic";

export default async function AllNewsPage() {
  const { payload } = await getNewsCalendarPayload();
  return <AllNewsView data={payload} />;
}
