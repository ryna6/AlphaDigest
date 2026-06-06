import { z } from "zod";
import { heatmapTileSchema, metricSchema, sourceMetaSchema } from "./common";

export const newsItemSchema = z.object({
  headline: z.string(),
  timestamp: z.string(),
  tickers: z.array(z.string()),
  whyItMatters: z.string(),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  publisher: z.string().optional(),
  sentiment: z.string().optional(),
  major: z.boolean().optional(),
  category: z.string().optional(),
  impact: z.enum(["Low", "Medium", "High"]).optional()
});

export const featuredArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  fetchedAt: z.string(),
  tags: z.array(z.string()),
  imageUrl: z.string().url().optional(),
  excerpt: z.string().optional(),
  contentText: z.string().optional(),
  contentHtml: z.string().optional(),
  sourceUrl: z.string().url().optional()
});

export const eventSchema = z.object({
  source: z.string().optional(),
  id: z.string().optional(),
  eventId: z.union([z.number(), z.string()]).nullable().optional(),
  eventKey: z.string().nullable().optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  time: z.string(),
  timestamp: z.string().nullable().optional(),
  event: z.string(),
  actual: z.string().nullable().optional(),
  forecast: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  referencePeriod: z.string().nullable().optional(),
  importance: z.enum(["Low", "Medium", "High"]),
  stars: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .nullable()
    .optional(),
  isHighlighted: z.boolean().optional(),
  highlightReason: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  fetchedAt: z.string().optional()
});

export const earningsSchema = z.object({
  ticker: z.string(),
  company: z.string(),
  time: z.enum(["BMO", "AMC", "TBD"]),
  expectedEps: z.string(),
  expectedRevenue: z.string().optional(),
  actualEps: z.string().optional(),
  actualRevenue: z.string().optional(),
  marketCap: z.string().optional(),
  logoUrl: z.string().url().optional()
});

export const unusualWhalesEarningsEventSchema = z.object({
  source: z.literal("unusual_whales_earnings"),
  id: z.string(),
  symbol: z.string(),
  companyName: z.string().nullable(),
  logo: z.string().url().nullable(),
  reportDate: z.string(),
  reportTime: z.string().nullable(),
  marketTime: z.string().nullable(),
  sector: z.string().nullable(),
  countryCode: z.string().nullable(),
  countryName: z.string().nullable(),
  isSp500: z.boolean(),
  hasOptions: z.boolean(),
  marketCapSize: z.string().nullable(),
  marketCap: z.number().nullable(),
  currentPrice: z.number().nullable(),
  previousPrice: z.number().nullable(),
  openInterest: z.number().nullable(),
  callVolume: z.number().nullable(),
  putVolume: z.number().nullable(),
  stockVolume: z.number().nullable(),
  expectedMove: z.number().nullable(),
  impliedMove: z.number().nullable(),
  impliedMovePct: z.number().nullable().default(null),
  streetMeanEstimate: z.number().nullable(),
  epsMeanEstimate: z.number().nullable(),
  lastEarningsDate: z.string().nullable(),
  priceLastEarnings: z.number().nullable(),
  lastOneDayReactions: z.array(z.number()),
  raw: z.record(z.string(), z.unknown()),
  contentHash: z.string(),
  fetchedAt: z.string()
});

export const earningsMetadataSchema = z
  .object({
    source: z.string(),
    ok: z.boolean(),
    fetchedAt: z.string(),
    changed: z.boolean().nullable(),
    rowCount: z.number().nullable(),
    contentHash: z.string().nullable(),
    error: z.string().nullable(),
    meta: z.record(z.string(), z.unknown()).nullable()
  })
  .nullable();

export const todayPayloadSchema = z.object({
  summary: z.object({ title: z.string(), regime: z.string(), bullets: z.array(z.string()) }),
  marketSummary: z.array(metricSchema),
  keyStats: z.array(metricSchema),
  featuredNews: z.array(featuredArticleSchema),
  earnings: z.array(earningsSchema),
  unusualWhalesEarnings: z.array(unusualWhalesEarningsEventSchema).default([]),
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

export const newsCalendarPayloadSchema = z.object({
  news: z.array(newsItemSchema),
  economicCalendar: z.array(eventSchema),
  earnings: z.array(earningsSchema),
  unusualWhalesEarnings: z.array(unusualWhalesEarningsEventSchema).default([]),
  earningsMetadata: earningsMetadataSchema.default(null),
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
export type FeaturedArticle = z.infer<typeof featuredArticleSchema>;
export type DashboardEvent = z.infer<typeof eventSchema>;
export type EarningsEvent = z.infer<typeof earningsSchema>;
export type UnusualWhalesEarningsEvent = z.infer<typeof unusualWhalesEarningsEventSchema>;
export type EarningsMetadata = z.infer<typeof earningsMetadataSchema>;
export type EconomicEvent = z.infer<typeof eventSchema>;
export type NewsCalendarPayload = z.infer<typeof newsCalendarPayloadSchema>;
export type TodayPayload = z.infer<typeof todayPayloadSchema>;
export type MarketsPayload = z.infer<typeof marketsPayloadSchema>;
export type FlowPayload = z.infer<typeof flowPayloadSchema>;
export type EconomyPayload = z.infer<typeof economyPayloadSchema>;
export type TickerPayload = z.infer<typeof tickerPayloadSchema>;
