import { createServerSupabaseClient } from "@/lib/db/supabase";
import { formatTorontoDateTime } from "@/lib/utils/time";

export type StatusValue = "Healthy" | "Warning" | "Error" | "Unknown";

export type StatusGroup =
  | "Today"
  | "Markets"
  | "News & Calendar"
  | "Flow"
  | "Ownership"
  | "Economy & Sentiment"
  | "Ticker Explorer";

export type StatusJob = {
  id: string;
  group: StatusGroup;
  job: string;
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
  "Economy & Sentiment",
  "Ticker Explorer"
];

export const STATUS_JOBS: StatusJob[] = [
  { id: "refresh-featured-articles", group: "Today", job: "Top News", metadataKey: "unusual_whales_featured_articles", frequency: "Every 30m", nextRun: "Every 30m", staleAfterHours: 2 },
  { id: "refresh-market-quotes", group: "Today", job: "Market Overview", metadataKey: "yahoo_market_quotes", frequency: "Market hours", nextRun: "Market hours", staleAfterHours: 4 },
  { id: "refresh-economic-events", group: "Today", job: "Today’s Economic Events", metadataKey: "investing_economic_events", frequency: "Weekdays", nextRun: "7:05 AM, 11:05 AM, 5:05 PM ET weekdays", staleAfterHours: 26 },
  { id: "fetch-uw-earnings", group: "Today", job: "Today’s Earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 1m", nextRun: "Every 1m", staleAfterHours: 2 },
  { id: "refresh-markets", group: "Markets", job: "Market Quotes / Indices / ETFs", metadataKey: "dashboard_snapshot:markets:latest", frequency: "Market hours", nextRun: "Market hours", staleAfterHours: 4 },
  { id: "refresh-put-call", group: "Markets", job: "Cboe Put/Call", frequency: "Market hours", nextRun: "Market hours", staleAfterHours: 26 },
  { id: "refresh-news-feed", group: "News & Calendar", job: "Unusual Whales News Feed", metadataKey: "unusual_whales_news_feed", frequency: "Every 30m", nextRun: "Every 30m", staleAfterHours: 2 },
  { id: "refresh-featured-articles", group: "News & Calendar", job: "Unusual Whales Featured Articles", metadataKey: "unusual_whales_featured_articles", frequency: "Every 30m", nextRun: "Every 30m", staleAfterHours: 2 },
  { id: "refresh-economic-events", group: "News & Calendar", job: "Investing.com Economic Events", metadataKey: "investing_economic_events", frequency: "Weekdays", nextRun: "Weekdays", staleAfterHours: 26 },
  { id: "fetch-uw-earnings", group: "News & Calendar", job: "Earnings Calendar", metadataKey: "unusual_whales_earnings", frequency: "Every 1m", nextRun: "Every 1m", staleAfterHours: 2 },
  { id: "refresh-dark-pool", group: "Flow", job: "Dark Pool", metadataKey: "unusual_whales_dark_pool_flows", frequency: "Daily", nextRun: "Daily", staleAfterHours: 36 },
  { id: "refresh-whale-feed", group: "Flow", job: "Whale Feed", metadataKey: "unusual_whales_whale_feed", frequency: "Weekdays", nextRun: "Weekdays", staleAfterHours: 36 },
  { id: "refresh-insider-trades", group: "Flow", job: "Insider Trades", metadataKey: "unusual_whales_insider_trades", frequency: "Daily", nextRun: "Daily", staleAfterHours: 36 },
  { id: "refresh-flow", group: "Flow", job: "Flow Snapshot", metadataKey: "dashboard_snapshot:flow:latest", frequency: "Daily", nextRun: "Daily", staleAfterHours: 36 },
  { id: "refresh-ownership", group: "Ownership", job: "Institutional / 13F", metadataKey: "dashboard_snapshot:ownership:latest", frequency: "Daily", nextRun: "Daily fixture-backed snapshot", staleAfterHours: 48 },
  { id: "refresh-ownership", group: "Ownership", job: "Congressional Trades", metadataKey: "dashboard_snapshot:ownership:latest", frequency: "Daily", nextRun: "Daily fixture-backed snapshot", staleAfterHours: 48 },
  { id: "refresh-economy", group: "Economy & Sentiment", job: "Economy & Sentiment Snapshot", frequency: "Manual", nextRun: "—" },
  { id: "refresh-ticker", group: "Ticker Explorer", job: "Ticker Explorer Snapshot", frequency: "Manual", nextRun: "—" }
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
