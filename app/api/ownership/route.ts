import { dashboardJson } from "@/lib/api/response";
import { getOwnershipPayload } from "@/lib/data/live-dashboard";
import { ownershipPayloadSchema } from "@/lib/data/schemas/dashboard";
export const dynamic = "force-dynamic";
export async function GET() { const { payload, mode, notices } = await getOwnershipPayload(); return dashboardJson({ schema: ownershipPayloadSchema, payload, mode, notices }); }
