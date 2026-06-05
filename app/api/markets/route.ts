import { dashboardJson } from "@/lib/api/response";
import { marketsMock } from "@/lib/data/fixtures/mock-dashboard";
import { marketsPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  const payload = marketsMock();
  return dashboardJson({ schema: marketsPayloadSchema, payload, notices: ["Mock heatmap data enabled.", ...payload.heatmapKeyMessages] });
}
