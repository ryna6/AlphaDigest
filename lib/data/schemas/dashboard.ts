import { z } from "zod";
import { heatmapTileSchema, metricSchema, sourceMetaSchema } from "./common";

export const newsItemSchema = z.object({
  headline: z.string(),
  timestamp: z.string(),
  tickers: z.array(z.string()),
  whyItMatters: z.string(),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  publisher: z.string().optional()
});

export const featuredArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  publishedAt: z.string().optional(),
  createdAt: z.string().optional(),
  fetchedAt: z.string(),
  tags: z.array(z.string()),
  excerpt: z.string().optional(),
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
  importance: z.enum(["Low", "Medium", "High"]),
  stars: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .nullable()
    .optional(),
  isHighlighted: z.boolean().optional(),
  highlightReason: z.string().nullable().optional(),
  fetchedAt: z.string().optional()
});

export const earningsSchema = z.object({
  id: z.string().optional(),
  ticker: z.string(),
  company: z.string(),
  time: z.enum(["BMO", "AMC", "TBD"]),
  expectedEps: z.string(),
  expectedRevenue: z.string().optional(),
  actualEps: z.string().optional(),
  actualRevenue: z.string().optional(),
  marketCap: z.string().optional(),
  reportDate: z.string().optional(),
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
  isSp500: z.boolean(),
  marketCapSize: z.string().nullable(),
  marketCap: z.number().nullable(),
  callVolume: z.number().nullable(),
  putVolume: z.number().nullable(),
  impliedMovePct: z.number().nullable().default(null),
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

export const marketWatchSignalSchema = z.enum([
  "new_high",
  "new_low",
  "crossed_above",
  "crossed_below",
  "at"
]);
export const marketWatchItemSchema = z.object({
  symbol: z.string(),
  signal: marketWatchSignalSchema,
  latestPrice: z.number(),
  referenceValue: z.number(),
  previousPrice: z.number().nullable(),
  previousReferenceValue: z.number().nullable(),
  eventDate: z.string(),
  magnitudePct: z.number().nullable()
});
export const marketWatchSectionSchema = z.object({
  available: z.boolean(),
  items: z.array(marketWatchItemSchema),
  eligibleSymbols: z.number(),
  reason: z.string().nullable()
});
export const marketWatchPayloadSchema = z.object({
  asOfDate: z.string().nullable(),
  highs52Week: marketWatchSectionSchema,
  lows52Week: marketWatchSectionSchema,
  crosses200Day: marketWatchSectionSchema,
  crosses200Week: marketWatchSectionSchema
});
export function emptyMarketWatchPayload(reason = "Unavailable") {
  const section = { available: false, items: [], eligibleSymbols: 0, reason };
  return {
    asOfDate: null,
    highs52Week: section,
    lows52Week: section,
    crosses200Day: section,
    crosses200Week: section
  };
}

export const marketsPayloadSchema = z.object({
  strip: z.array(metricSchema),
  heatmaps: z.object({
    globalMarkets: z.array(heatmapTileSchema),
    sectors: z.array(heatmapTileSchema),
    crypto: z.array(heatmapTileSchema),
    macro: z.array(heatmapTileSchema),
    sp500: z.array(heatmapTileSchema)
  }),
  heatmapKeyMessages: z.array(z.string()),
  breadth: z.array(metricSchema),
  movers: z.array(metricSchema),
  marketWatch: marketWatchPayloadSchema.default(
    emptyMarketWatchPayload("Cached snapshot predates Market Watch")
  ),
  sourceMeta: z.array(sourceMetaSchema),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const flowTradeSideSchema = z.enum(["ask", "bid", "unknown"]);
export const flowTradeSentimentSchema = z.enum(["bullish", "bearish", "unknown"]);

export const darkPoolFlowRowSchema = z.object({
  externalId: z.string(),
  executedAt: z.string(),
  ticker: z.string(),
  sector: z.string().nullable(),
  price: z.number().nullable(),
  premium: z.number().nullable(),
  size: z.number().nullable().optional(),
  volume: z.number().nullable(),
  avg30Volume: z.number().nullable().optional(),
  fetchedAt: z.string().optional()
});

export const whaleFeedRowSchema = z.object({
  externalId: z.string(),
  executedAt: z.string(),
  ticker: z.string(),
  sector: z.string().nullable(),
  price: z.number().nullable(),
  nbboAsk: z.number().nullable(),
  nbboBid: z.number().nullable(),
  side: flowTradeSideSchema,
  sentiment: flowTradeSentimentSchema,
  premium: z.number().nullable(),
  size: z.number().nullable(),
  volume: z.number().nullable(),
  avg30Volume: z.number().nullable(),
  fetchedAt: z.string().optional()
});

export const insiderTradeRowSchema = z.object({
  externalId: z.string(),
  ticker: z.string(),
  sector: z.string().nullable(),
  amount: z.number(),
  transactionDate: z.string(),
  price: z.number().nullable(),
  ownerName: z.string().nullable(),
  officerTitle: z.string().nullable(),
  transactionCode: z.enum(["P", "S"]),
  sharesOwnedAfter: z.number().nullable(),
  fetchedAt: z.string().optional()
});

export const insiderCompanyAggregateSchema = z.object({
  ticker: z.string(),
  sector: z.string().nullable(),
  tradeCount: z.number(),
  netShares: z.number(),
  netValue: z.number(),
  purchaseCount: z.number(),
  saleCount: z.number(),
  averageTradePrice: z.number().nullable()
});

export const flowPayloadSchema = z.object({
  summary: z.array(metricSchema),
  darkPool: z.array(darkPoolFlowRowSchema),
  whaleTrades: z.array(whaleFeedRowSchema),
  insiderTrades: z.array(insiderCompanyAggregateSchema),
  diagnostics: z
    .object({
      insiderLookbackMonths: z.number().optional(),
      insiderRowsUsed: z.number().optional(),
      insiderCompaniesAggregated: z.number().optional(),
      insiderSource: z.string().optional(),
      darkPoolWindowDays: z.number().optional(),
      darkPoolSummaryWindowDays: z.number().optional(),
      darkPoolRowsUsed: z.number().optional(),
      whaleFeedRowsUsed: z.number().optional(),
      whaleFeedSource: z.string().optional()
    })
    .optional(),
  sourceMeta: z.array(sourceMetaSchema),
  notices: z.array(z.string()).default([])
});

export const ownershipPayloadSchema = z.object({
  institutionalPositioning: z.array(z.record(z.string(), z.string())),
  institutionalSummary: z
    .object({
      tickerFlow: z.array(
        z
          .object({
            investorType: z.enum(["value", "activist", "13d_activist", "tiger_cub"]),
            order: z.string(),
            ticker: z.string(),
            value: z.number().nullable(),
            reportDate: z.string(),
            increasedPositions: z.number().nullable(),
            decreasedPositions: z.number().nullable(),
            holdingCount: z.number().nullable(),
            units: z.number().nullable(),
            prevUnits: z.number().nullable()
          })
          .passthrough()
      ),
      sectorExposure: z.array(
        z
          .object({
            investorType: z.enum(["value", "activist", "13d_activist", "tiger_cub"]),
            sector: z.string(),
            value: z.number().nullable(),
            reportDate: z.string(),
            qoq: z.number().finite().nullable(),
            yoy: z.number().finite().nullable()
          })
          .passthrough()
      ),
      notices: z.array(z.string()),
      metadata: z
        .object({
          selectedReportDatesByInvestorType: z.record(z.string(), z.string()),
          rejectedPeriodsByInvestorType: z.record(
            z.string(),
            z.record(z.string(), z.array(z.string()))
          )
        })
        .optional()
    })
    .optional(),
  sourceMeta: z.array(sourceMetaSchema),
  notices: z.array(z.string()).default([])
});

export const sentimentPayloadSchema = z.object({
  sentiment: z.array(metricSchema),
  sourceMeta: z.array(sourceMetaSchema),
  notices: z.array(z.string()).default([])
});

export const insiderTradesPayloadSchema = z.object({
  companies: z.array(insiderCompanyAggregateSchema),
  sourceMeta: z.array(sourceMetaSchema),
  notices: z.array(z.string()).default([])
});

export const insiderTradeDetailPayloadSchema = z.object({
  ticker: z.string(),
  aggregate: insiderCompanyAggregateSchema.nullable(),
  trades: z.array(insiderTradeRowSchema),
  sourceMeta: z.array(sourceMetaSchema),
  notices: z.array(z.string()).default([])
});

export const newsCalendarPayloadSchema = z.object({
  news: z.array(newsItemSchema),
  economicCalendar: z.array(eventSchema),
  earnings: z.array(earningsSchema),
  unusualWhalesEarnings: z.array(unusualWhalesEarningsEventSchema).default([]),
  earningsMetadata: earningsMetadataSchema.default(null),
  earningsMessage: z.string().optional(),
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
export type MarketWatchSignal = z.infer<typeof marketWatchSignalSchema>;
export type MarketWatchItem = z.infer<typeof marketWatchItemSchema>;
export type MarketWatchSection = z.infer<typeof marketWatchSectionSchema>;
export type MarketWatchPayload = z.infer<typeof marketWatchPayloadSchema>;
export type MarketsPayload = z.infer<typeof marketsPayloadSchema>;
export type DarkPoolFlowRow = z.infer<typeof darkPoolFlowRowSchema>;
export type WhaleFeedRow = z.infer<typeof whaleFeedRowSchema>;
export type InsiderTradeRow = z.infer<typeof insiderTradeRowSchema>;
export type InsiderCompanyAggregate = z.infer<typeof insiderCompanyAggregateSchema>;
export type FlowPayload = z.infer<typeof flowPayloadSchema>;
export type OwnershipPayload = z.infer<typeof ownershipPayloadSchema>;
export type SentimentPayload = z.infer<typeof sentimentPayloadSchema>;
export type InsiderTradesPayload = z.infer<typeof insiderTradesPayloadSchema>;
export type InsiderTradeDetailPayload = z.infer<typeof insiderTradeDetailPayloadSchema>;
export type TickerPayload = z.infer<typeof tickerPayloadSchema>;
