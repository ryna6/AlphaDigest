import { startPerformanceSpan } from "@/lib/observability/performance";
import { dashboardJson } from "@/lib/api/response";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { todayPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const perf = startPerformanceSpan("today_payload");
  const result = await getServingDashboardSnapshot("today:latest");
  if (!result.ok) return Response.json(result, { status: 503 });
  const { payload, mode, notices, metadata: snapshot } = result;
  perf.mark("payload");
  const response = dashboardJson({ schema: todayPayloadSchema, payload, mode, notices, snapshot });
  const finished = perf.finish();
  response.headers.set("Server-Timing", finished.serverTiming);
  return response;
}
