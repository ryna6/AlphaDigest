import { NewsCalendarView } from "@/components/dashboard/news-calendar/news-calendar-view";
import { getCalendarRange, parseCalendarRangeKey } from "@/lib/data/calendar-range";
import { getNewsCalendarPayload } from "@/lib/data/live-dashboard";

export const dynamic = "force-dynamic";

export default async function NewsCalendarPage({
  searchParams
}: {
  searchParams?: { range?: string };
}) {
  const rangeKey = parseCalendarRangeKey(searchParams?.range);
  const selectedRange = getCalendarRange(rangeKey);
  const { payload } = await getNewsCalendarPayload(rangeKey);
  return <NewsCalendarView data={payload} selectedRange={selectedRange} />;
}
