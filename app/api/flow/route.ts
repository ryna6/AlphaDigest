import { startPerformanceSpan } from "@/lib/observability/performance";
import { dashboardJson } from "@/lib/api/response";
import { getFlowPayload } from "@/lib/data/live-dashboard";
import { flowPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const perf = startPerformanceSpan("flow_payload");
  const { payload, mode, notices } = await getFlowPayload();
  perf.mark("payload");
  const response = dashboardJson({ schema: flowPayloadSchema, payload, mode, notices });
  const finished = perf.finish();
  response.headers.set("Server-Timing", finished.serverTiming);
  return response;
}
