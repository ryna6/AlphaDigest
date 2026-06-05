import { dashboardJson } from "@/lib/api/response";
import { economyMock } from "@/lib/data/fixtures/mock-dashboard";
import { economyPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  return dashboardJson({ schema: economyPayloadSchema, payload: economyMock });
}
