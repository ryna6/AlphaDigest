import { jsonResponse } from "@/lib/api/json";
import { keyMarketStats, mockNews, mockSourceMeta } from "@/lib/data/fixtures/market";
import { todayPayloadSchema } from "@/lib/data/schemas/api";

export const dynamic = "force-dynamic";

export function GET() {
  const payload = todayPayloadSchema.parse({ meta: mockSourceMeta, keyMarketStats, news: mockNews });
  return jsonResponse(payload);
}
