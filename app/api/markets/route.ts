import { dashboardJson } from "@/lib/api/response";
import { getMarketsPayload } from "@/lib/data/live-dashboard";
import { marketsPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { payload, mode, notices } = await getMarketsPayload();
  return dashboardJson({ schema: marketsPayloadSchema, payload, mode, notices });
}
