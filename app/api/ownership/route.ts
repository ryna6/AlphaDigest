import { dashboardJson } from "@/lib/api/response";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";
import { ownershipPayloadSchema } from "@/lib/data/schemas/dashboard";
export const dynamic = "force-dynamic";
export async function GET() {
  const result = await getServingDashboardSnapshot("ownership:latest");
  if (!result.ok) return Response.json(result, { status: 503 });
  const { payload, mode, notices, metadata: snapshot } = result;
  return dashboardJson({ schema: ownershipPayloadSchema, payload, mode, notices, snapshot });
}
