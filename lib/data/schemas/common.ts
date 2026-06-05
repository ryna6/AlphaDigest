import { z } from "zod";

export const freshnessStatusSchema = z.enum([
  "fresh",
  "delayed",
  "stale",
  "degraded",
  "unavailable",
]);

export const sourceMetaSchema = z.object({
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  lastUpdated: z.string(),
  status: freshnessStatusSchema,
  mode: z.enum(["mock", "live", "cached"]),
  message: z.string().optional(),
});

export const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  changePercent: z.string().optional(),
  direction: z.enum(["up", "down", "flat"]).optional(),
  source: z.string().optional(),
});

export const heatmapTileSchema = z.object({
  label: z.string(),
  ticker: z.string(),
  value: z.string(),
  changePercent: z.number(),
  weight: z.number(),
  source: z.string(),
  lastUpdated: z.string(),
});
