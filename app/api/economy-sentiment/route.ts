import { jsonResponse } from "@/lib/api/json";
import { commodityQuotePlans } from "@/lib/data/adapters/commodity-prices-adapter";
import { mockSourceMeta } from "@/lib/data/fixtures/market";

export const dynamic = "force-dynamic";
export function GET() {
  return jsonResponse({ meta: mockSourceMeta, mode: "mock", regime: "Neutral", commodityQuotePlans });
}
