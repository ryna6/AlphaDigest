import { dashboardJson } from "@/lib/api/response";
import { parseCalendarRangeKey } from "@/lib/data/calendar-range";
import { getNewsCalendarPayload } from "@/lib/data/live-dashboard";
import { newsCalendarPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rangeKey = parseCalendarRangeKey(new URL(request.url).searchParams.get("range"));
  const { payload, mode, notices } = await getNewsCalendarPayload(rangeKey);
  return dashboardJson({ schema: newsCalendarPayloadSchema, payload, mode, notices });
}
