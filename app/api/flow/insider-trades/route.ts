import { dashboardJson } from "@/lib/api/response";
import { getInsiderTradesPayload } from "@/lib/data/live-dashboard";
import { insiderTradesPayloadSchema } from "@/lib/data/schemas/dashboard";
export const dynamic = "force-dynamic";
export async function GET() { const { payload, mode, notices } = await getInsiderTradesPayload(50); return dashboardJson({ schema: insiderTradesPayloadSchema, payload, mode, notices }); }
