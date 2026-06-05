import { z } from "zod";

export const freshnessStatusSchema = z.enum([
  "fresh",
  "delayed",
  "stale",
  "degraded",
  "unavailable"
]);

export type FreshnessStatus = z.infer<typeof freshnessStatusSchema>;

export const sourceMetaSchema = z.object({
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  lastUpdated: z.string(),
  status: freshnessStatusSchema,
  mode: z.enum(["mock", "live", "cached"]),
  message: z.string().optional()
});

export type SourceMeta = z.infer<typeof sourceMetaSchema>;

export const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  changePercent: z.string().optional(),
  status: freshnessStatusSchema.default("fresh")
});

export type Metric = z.infer<typeof metricSchema>;

export const heatmapTileSchema = z.object({
  label: z.string(),
  symbol: z.string(),
  value: z.string(),
  changePercent: z.number(),
  weight: z.number().min(1).max(12),
  source: z.string(),
  lastUpdated: z.string()
});

export type HeatmapTile = z.infer<typeof heatmapTileSchema>;
