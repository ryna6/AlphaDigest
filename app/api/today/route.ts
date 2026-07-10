import { startPerformanceSpan } from "@/lib/observability/performance";
import { dashboardJson } from "@/lib/api/response";
import { getTodayPayload } from "@/lib/data/live-dashboard";
import { todayPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const perf = startPerformanceSpan("today_payload");
  const { payload, mode, notices } = await getTodayPayload();
  perf.mark("payload");
  const response = dashboardJson({ schema: todayPayloadSchema, payload, mode, notices });
  const finished = perf.finish();
  response.headers.set("Server-Timing", finished.serverTiming);
  return response;
}
