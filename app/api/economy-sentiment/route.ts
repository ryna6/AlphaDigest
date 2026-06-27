import { dashboardJson } from "@/lib/api/response";
import { economyMainCards, economySummaryCards } from "@/lib/data/economy-config";
import { economyPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  return dashboardJson({
    schema: economyPayloadSchema,
    payload: {
      summaryCards: economySummaryCards,
      mainCards: economyMainCards,
      sourceMeta: [],
      notices: ["Economy data endpoints are pending confirmation; no live ingestion is implemented yet."]
    }
  });
}
