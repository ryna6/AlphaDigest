import { dashboardJson } from "@/lib/api/response";
import { getNewsCalendarPayload } from "@/lib/data/live-dashboard";
import { newsCalendarPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { payload, mode, notices } = await getNewsCalendarPayload();
  return dashboardJson({ schema: newsCalendarPayloadSchema, payload, mode, notices });
}
