import { jsonResponse } from "@/lib/api/responses";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";
import { cryptoHeatmap, globalHeatmap, macroHeatmap, mockMeta, sectorHeatmap } from "@/lib/data/fixtures/dashboard";
import { marketsPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET() {
  return jsonResponse(marketsPayloadSchema, {
    meta: mockMeta,
    heatmaps: { global: globalHeatmap, sectors: sectorHeatmap, crypto: cryptoHeatmap, macro: macroHeatmap },
    finnhubKeyStatus: getFinnhubKeyStatus(),
  });
}
