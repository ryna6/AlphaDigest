import { dashboardJson } from "@/lib/api/response";
import { getTodayPayload } from "@/lib/data/live-dashboard";
import { todayPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { payload, mode, notices } = await getTodayPayload();
  return dashboardJson({ schema: todayPayloadSchema, payload, mode, notices });
}
