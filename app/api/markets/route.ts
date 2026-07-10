import { startPerformanceSpan } from "@/lib/observability/performance";
import { dashboardJson } from "@/lib/api/response";
import { getMarketsPayload } from "@/lib/data/live-dashboard";
import { marketsPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const perf = startPerformanceSpan("markets_payload");
  const { payload, mode, notices } = await getMarketsPayload();
  perf.mark("payload");
  const response = dashboardJson({ schema: marketsPayloadSchema, payload, mode, notices });
  const finished = perf.finish();
  response.headers.set("Server-Timing", finished.serverTiming);
  return response;
}
