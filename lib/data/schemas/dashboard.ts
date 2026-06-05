import { z } from "zod";
import { heatmapTileSchema, metricSchema, sourceMetaSchema } from "./common";

export const todayPayloadSchema = z.object({
  meta: sourceMetaSchema,
  summary: z.object({ headline: z.string(), stance: z.string(), notes: z.array(z.string()) }),
  keyMarketStats: z.array(metricSchema),
});

export const marketsPayloadSchema = z.object({
  meta: sourceMetaSchema,
  heatmaps: z.object({
    global: z.array(heatmapTileSchema),
    sectors: z.array(heatmapTileSchema),
    crypto: z.array(heatmapTileSchema),
    macro: z.array(heatmapTileSchema),
  }),
  finnhubKeyStatus: z.array(z.object({
    ok: z.boolean(),
    featureArea: z.string(),
    envVar: z.string(),
    label: z.string(),
    message: z.string().optional(),
  })),
});

export const genericPayloadSchema = z.object({
  meta: sourceMetaSchema,
  message: z.string(),
  rows: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
});
