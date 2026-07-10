import { startPerformanceSpan } from "@/lib/observability/performance";
import { dashboardJson } from "@/lib/api/response";
import { getEconomyPayload } from "@/lib/data/economy";
import { economyPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const perf = startPerformanceSpan("economy_payload");
  const { payload, mode, notices } = await getEconomyPayload();
  perf.mark("payload");
  const response = dashboardJson({
    schema: economyPayloadSchema,
    payload: { ...payload, notices },
    mode,
    notices
  });
  const finished = perf.finish();
  response.headers.set("Server-Timing", finished.serverTiming);
  return response;
}
