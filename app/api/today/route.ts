import { dashboardJson } from "@/lib/api/response";
import { todayMock } from "@/lib/data/fixtures/mock-dashboard";
import { todayPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  return dashboardJson({ schema: todayPayloadSchema, payload: todayMock });
}
