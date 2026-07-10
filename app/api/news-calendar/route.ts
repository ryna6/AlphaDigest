import { startPerformanceSpan } from "@/lib/observability/performance";
import { dashboardJson } from "@/lib/api/response";
import { getNewsCalendarPayload } from "@/lib/data/live-dashboard";
import { newsCalendarPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const perf = startPerformanceSpan("news_calendar_payload");
  const { payload, mode, notices } = await getNewsCalendarPayload();
  perf.mark("payload");
  const response = dashboardJson({ schema: newsCalendarPayloadSchema, payload, mode, notices });
  const finished = perf.finish();
  response.headers.set("Server-Timing", finished.serverTiming);
  return response;
}
