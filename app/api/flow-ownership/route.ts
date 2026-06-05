import { dashboardJson } from "@/lib/api/response";
import { flowMock } from "@/lib/data/fixtures/mock-dashboard";
import { flowPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  return dashboardJson({ schema: flowPayloadSchema, payload: flowMock });
}
