import { jsonResponse } from "@/lib/api/responses";
import { keyMarketStats, mockMeta } from "@/lib/data/fixtures/dashboard";
import { todayPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  return jsonResponse(todayPayloadSchema, {
    meta: mockMeta,
    summary: {
      headline: "Mock daily market briefing",
      stance: "Constructive but source-degraded",
      notes: ["Live adapters are pending.", "No secret keys are exposed to the client."],
    },
    keyMarketStats,
  });
}
