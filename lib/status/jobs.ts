import { createServerSupabaseClient } from "@/lib/db/supabase";
import { formatTorontoDateTime } from "@/lib/utils/time";

export type StatusValue = "Healthy" | "Warning" | "Error" | "Unknown";

export type StatusGroup =
  | "Today"
  | "Markets"
  | "News & Calendar"
  | "Flow"
  | "Ownership"
  | "Economy & Sentiment";

export type StatusJob = {
  id: string;
  group: StatusGroup;
  job: string;
  functionName: string | "TBD";
  metadataKey?: string;
  frequency: string;
  nextRun: string;
  staleAfterHours?: number;
};

export type StatusRow = StatusJob & {
  status: StatusValue;
  lastRun: string;
  error: string | null;
};

type MetadataRow = {
  source: string;
  ok: boolean | null;
  fetched_at: string | null;
  updated_at?: string | null;
  error: string | null;
};

export const STATUS_GROUPS: StatusGroup[] = [
  "Today",
  "Markets",
  "News & Calendar",
  "Flow",
  "Ownership",
  "Economy & Sentiment"
];

export const STATUS_JOBS: StatusJob[] = [
  { id: "today-market-overview", group: "Today", job: "Market Overview", functionName: "refresh-market-quotes", metadataKey: "yahoo_market_quotes", frequency: "Every 15m / market hours", nextRun: "Every 15m during market hours", staleAfterHours: 4 },
  { id: "today-put-call-ratio", group: "Today", job: "Put/Call Ratio", functionName: "refresh-put-call", frequency: "Every 30m / market hours", nextRun: "Every 30m during market hours", staleAfterHours: 26 },
  { id: "today-top-news", group: "Today", job: "Top News", functionName: "refresh-featured-articles", metadataKey: "unusual_whales_featured_articles", frequency: "Every 30m", nextRun: "Every 30m", staleAfterHours: 2 },
  { id: "today-economic-events", group: "Today", job: "Today’s Economic Events", functionName: "refresh-economic-events", metadataKey: "investing_economic_events", frequency: "Weekdays", nextRun: "7:05 AM, 11:05 AM, 5:05 PM ET weekdays", staleAfterHours: 26 },
  { id: "today-earnings", group: "Today", job: "Today’s Earnings", functionName: "fetch-uw-earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 1m", nextRun: "Every 1m", staleAfterHours: 2 },
  { id: "markets-indices-heatmaps", group: "Markets", job: "Indices/Heatmaps", functionName: "refresh-markets", metadataKey: "dashboard_snapshot:markets:latest", frequency: "Every 10m / market hours", nextRun: "Every 10m during market hours", staleAfterHours: 4 },
  { id: "markets-breadth", group: "Markets", job: "Market Breadth", functionName: "TBD", frequency: "TBD", nextRun: "—" },
  { id: "markets-movers", group: "Markets", job: "Movers / Leaders / Laggards", functionName: "TBD", frequency: "TBD", nextRun: "—" },
  { id: "news-calendar-news-feed", group: "News & Calendar", job: "Unusual Whales News Feed", functionName: "refresh-news-feed", metadataKey: "unusual_whales_news_feed", frequency: "Every 30m", nextRun: "Every 30m", staleAfterHours: 2 },
  { id: "news-calendar-economic-events", group: "News & Calendar", job: "Economic Events", functionName: "refresh-economic-events", metadataKey: "investing_economic_events", frequency: "Weekdays", nextRun: "Weekdays", staleAfterHours: 26 },
  { id: "news-calendar-earnings", group: "News & Calendar", job: "Earnings Calendar", functionName: "fetch-uw-earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 1m", nextRun: "Every 1m", staleAfterHours: 2 },
  { id: "flow-insider-trades", group: "Flow", job: "Insider Trades", functionName: "refresh-insider-trades", metadataKey: "unusual_whales_insider_trades", frequency: "Daily", nextRun: "Daily", staleAfterHours: 36 },
  { id: "flow-dark-pool", group: "Flow", job: "Dark Pool", functionName: "refresh-dark-pool", metadataKey: "unusual_whales_dark_pool_flows", frequency: "Daily", nextRun: "Daily", staleAfterHours: 36 },
  { id: "flow-whale-feed", group: "Flow", job: "Whale Feed", functionName: "refresh-whale-feed", metadataKey: "unusual_whales_whale_feed", frequency: "Weekdays", nextRun: "Weekdays", staleAfterHours: 36 },
  { id: "flow-snapshot", group: "Flow", job: "Flow Snapshot", functionName: "refresh-flow", metadataKey: "dashboard_snapshot:flow:latest", frequency: "Daily", nextRun: "Daily", staleAfterHours: 36 },
  { id: "ownership-institutional", group: "Ownership", job: "Institutional", functionName: "TBD", frequency: "TBD", nextRun: "—" },
  { id: "ownership-congressional-trades", group: "Ownership", job: "Congressional Trades", functionName: "TBD", frequency: "TBD", nextRun: "—" },
  { id: "economy-sentiment-tbd", group: "Economy & Sentiment", job: "TBD", functionName: "TBD", frequency: "TBD", nextRun: "—" }
];

function statusFor(job: StatusJob, metadata?: MetadataRow): StatusValue {
  if (!job.metadataKey || !metadata) return "Unknown";
  if (metadata.ok === false || metadata.error) return "Error";
  const fetchedAt = metadata.fetched_at ?? metadata.updated_at;
  if (!fetchedAt) return "Unknown";
  if (job.staleAfterHours) {
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > job.staleAfterHours * 60 * 60 * 1000) return "Warning";
  }
  return metadata.ok === true ? "Healthy" : "Unknown";
}

export async function getStatusRows(): Promise<StatusRow[]> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) {
    return STATUS_JOBS.map((job) => ({ ...job, status: "Unknown", lastRun: "—", error: null }));
  }

  const keys = Array.from(new Set(STATUS_JOBS.map((job) => job.metadataKey).filter(Boolean))) as string[];
  const { data } = await supabase.client
    .from("data_refresh_metadata")
    .select("source,ok,fetched_at,updated_at,error")
    .in("source", keys);
  const metadata = new Map((data ?? []).map((row) => [row.source, row as MetadataRow]));

  return STATUS_JOBS.map((job) => {
    const row = job.metadataKey ? metadata.get(job.metadataKey) : undefined;
    const lastTimestamp = row?.fetched_at ?? row?.updated_at ?? null;
    return {
      ...job,
      status: statusFor(job, row),
      lastRun: lastTimestamp ? formatTorontoDateTime(lastTimestamp) : "—",
      error: row?.error ?? null
    };
  });
}
