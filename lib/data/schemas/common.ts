import { z } from "zod";

export const sourceMetaSchema = z.object({
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  lastUpdated: z.string(),
  mode: z.enum(["mock", "live", "cached", "unavailable"]),
  message: z.string().optional()
});
export type SourceMeta = z.infer<typeof sourceMetaSchema>;

export const putCallRatiosSchema = z.object({
  equity: z.number().nullable(),
  index: z.number().nullable(),
  total: z.number().nullable()
});
export type PutCallRatios = z.infer<typeof putCallRatiosSchema>;

export const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  changePercent: z.string().optional(),
  iconPath: z.string().optional(),
  putCallRatios: putCallRatiosSchema.optional(),
  putCallAsOf: z.string().nullable().optional(),
  putCallFreshness: z.string().optional(),
  leadingSectors: z
    .array(
      z.object({
        symbol: z.string(),
        label: z.string(),
        changePercent: z.number().finite().nullable()
      })
    )
    .max(3)
    .optional(),
  href: z.string().optional(),
  subtext: z.string().optional(),
  purchaseValue: z.number().optional(),
  saleValue: z.number().optional(),
  ratio: z.number().nullable().optional(),
  tone: z.enum(["positive", "negative", "neutral", "warning"]).default("neutral")
});
export type Metric = z.infer<typeof metricSchema>;

export const heatmapTileSchema = z.object({
  symbol: z.string(),
  label: z.string(),
  value: z.number(),
  changePercent: z.number(),
  weight: z.number(),
  iconPath: z.string().optional(),
  sector: z.string().optional(),
  aggregate: z.boolean().optional()
});
export type HeatmapTile = z.infer<typeof heatmapTileSchema>;

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    generatedAt: z.string(),
    timezone: z.literal("America/Toronto"),
    mode: z.enum(["mock", "live", "cached", "unavailable"]),
    notices: z.array(z.string()),
    payload
  });
