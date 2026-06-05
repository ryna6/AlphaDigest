import { jsonResponse } from "@/lib/api/json";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";
import { heatmapTiles, marketStrip, mockSourceMeta } from "@/lib/data/fixtures/market";
import { marketsPayloadSchema } from "@/lib/data/schemas/api";

export const dynamic = "force-dynamic";

export function GET() {
  const payload = marketsPayloadSchema.parse({ meta: mockSourceMeta, marketStrip, heatmapTiles, finnhubKeyStatus: getFinnhubKeyStatus() });
  return jsonResponse(payload);
}
