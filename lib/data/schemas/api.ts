import { z } from "zod";
import { heatmapTileSchema, metricSchema, sourceMetaSchema } from "./common";

export const todayPayloadSchema = z.object({
  meta: sourceMetaSchema,
  keyMarketStats: z.array(metricSchema),
  news: z.array(z.object({ headline: z.string(), time: z.string(), tags: z.array(z.string()), why: z.string(), source: z.string() }))
});

export const marketsPayloadSchema = z.object({
  meta: sourceMetaSchema,
  marketStrip: z.array(metricSchema),
  heatmapTiles: z.array(heatmapTileSchema),
  finnhubKeyStatus: z.array(z.object({ featureArea: z.string(), label: z.string(), envName: z.string(), configured: z.boolean(), status: z.string(), message: z.string() }))
});
