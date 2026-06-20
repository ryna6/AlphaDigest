import { dashboardJson } from "@/lib/api/response";
import { getFlowPayload } from "@/lib/data/live-dashboard";
import { flowPayloadSchema } from "@/lib/data/schemas/dashboard";
export const dynamic = "force-dynamic";
export async function GET() { const { payload, mode, notices } = await getFlowPayload(); return dashboardJson({ schema: flowPayloadSchema, payload, mode, notices }); }
