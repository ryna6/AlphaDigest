import { z } from "zod";

export const sourceMetaSchema = z.object({
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  lastUpdated: z.string(),
  mode: z.enum(["mock", "live", "cached", "unavailable"]),
  message: z.string().optional()
});
export type SourceMeta = z.infer<typeof sourceMetaSchema>;

export const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  changePercent: z.string().optional(),
  tone: z.enum(["positive", "negative", "neutral", "warning"]).default("neutral")
});
export type Metric = z.infer<typeof metricSchema>;

export const heatmapTileSchema = z.object({
  symbol: z.string(),
  label: z.string(),
  value: z.number(),
  changePercent: z.number(),
  weight: z.number(),
  iconPath: z.string().optional()
});
export type HeatmapTile = z.infer<typeof heatmapTileSchema>;

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    generatedAt: z.string(),
    timezone: z.literal("America/New_York"),
    mode: z.enum(["mock", "live", "cached", "unavailable"]),
    notices: z.array(z.string()),
    payload
  });
