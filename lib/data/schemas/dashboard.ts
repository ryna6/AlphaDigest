import { z } from "zod";
import { heatmapTileSchema, metricSchema, sourceMetaSchema } from "./common";

export const newsItemSchema = z.object({
  headline: z.string(),
  timestamp: z.string(),
  tickers: z.array(z.string()),
  whyItMatters: z.string(),
  source: z.string().optional(),
  category: z.string().optional(),
  impact: z.enum(["Low", "Medium", "High"]).optional()
});

export const eventSchema = z.object({
  time: z.string(),
  event: z.string(),
  actual: z.string().optional(),
  forecast: z.string().optional(),
  previous: z.string().optional(),
  importance: z.enum(["Low", "Medium", "High"])
});

export const earningsSchema = z.object({
  ticker: z.string(),
  company: z.string(),
  time: z.enum(["BMO", "AMC", "TBD"]),
  expectedEps: z.string(),
  expectedRevenue: z.string().optional(),
  marketCap: z.string().optional()
});

export const todayPayloadSchema = z.object({
  summary: z.object({ title: z.string(), regime: z.string(), bullets: z.array(z.string()) }),
  marketSummary: z.array(metricSchema),
  keyStats: z.array(metricSchema),
  featuredNews: z.array(newsItemSchema),
  earnings: z.array(earningsSchema),
  economicCalendar: z.array(eventSchema),
  sectorSnapshot: z.array(metricSchema),
  sourceMeta: z.array(sourceMetaSchema)
});

export const marketsPayloadSchema = z.object({
  strip: z.array(metricSchema),
  heatmaps: z.object({
    globalMarkets: z.array(heatmapTileSchema),
    sectors: z.array(heatmapTileSchema),
    crypto: z.array(heatmapTileSchema),
    macro: z.array(heatmapTileSchema)
  }),
  heatmapKeyMessages: z.array(z.string()),
  breadth: z.array(metricSchema),
  movers: z.array(metricSchema),
  sourceMeta: z.array(sourceMetaSchema)
});

export const flowPayloadSchema = z.object({
  summary: z.array(metricSchema),
  darkPool: z.array(z.record(z.string(), z.string())),
  whaleTrades: z.array(z.record(z.string(), z.string())),
  insiderTrades: z.array(z.record(z.string(), z.string())),
  congressionalTrades: z.array(z.record(z.string(), z.string())),
  institutionalPositioning: z.array(z.record(z.string(), z.string())),
  sourceMeta: z.array(sourceMetaSchema)
});

export const economyPayloadSchema = z.object({
  regimeBadges: z.array(metricSchema),
  rates: z.array(metricSchema),
  inflation: z.array(metricSchema),
  labor: z.array(metricSchema),
  sentiment: z.array(metricSchema),
  oilRisk: z.array(metricSchema),
  liquidity: z.array(metricSchema),
  sourceMeta: z.array(sourceMetaSchema)
});

export const tickerPayloadSchema = z.object({
  symbol: z.string(),
  header: z.array(metricSchema),
  story: z.string(),
  timeline: z.array(newsItemSchema),
  flow: z.array(metricSchema),
  ownership: z.array(metricSchema),
  sectorContext: z.array(metricSchema),
  sourceMeta: z.array(sourceMetaSchema)
});

export type NewsItem = z.infer<typeof newsItemSchema>;
export type DashboardEvent = z.infer<typeof eventSchema>;
export type EarningsEvent = z.infer<typeof earningsSchema>;
export type TodayPayload = z.infer<typeof todayPayloadSchema>;
export type MarketsPayload = z.infer<typeof marketsPayloadSchema>;
export type FlowPayload = z.infer<typeof flowPayloadSchema>;
export type EconomyPayload = z.infer<typeof economyPayloadSchema>;
export type TickerPayload = z.infer<typeof tickerPayloadSchema>;
