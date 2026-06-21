import { createServerSupabaseClient } from "@/lib/db/supabase";
import { formatTorontoDateTime } from "@/lib/utils/time";

export type StatusValue = "Healthy" | "Warning" | "Error" | "Unknown";

export type StatusJob = {
  id: string;
  component: string;
  tab: string;
  metadataKey?: string;
  schedule: string;
  staleAfterHours?: number;
};

export type StatusRow = StatusJob & {
  status: StatusValue;
  lastRun: string;
  nextRun: string;
  error: string | null;
};

type MetadataRow = {
  source: string;
  ok: boolean | null;
  fetched_at: string | null;
  updated_at?: string | null;
  error: string | null;
};

export const STATUS_JOBS: StatusJob[] = [
  { id: "refresh-featured-articles", component: "Top News", tab: "Today", metadataKey: "unusual_whales_featured_articles", schedule: "Every 30 minutes", staleAfterHours: 2 },
  { id: "refresh-market-quotes", component: "Market Overview", tab: "Today", metadataKey: "yahoo_market_quotes", schedule: "Market hours", staleAfterHours: 4 },
  { id: "refresh-economic-events", component: "Today’s Economic Events", tab: "Today", metadataKey: "investing_economic_events", schedule: "Weekdays at 7:05 AM, 11:05 AM, 5:05 PM ET", staleAfterHours: 26 },
  { id: "fetch-uw-earnings", component: "Today’s Earnings", tab: "Today", metadataKey: "unusual_whales_earnings", schedule: "Every minute", staleAfterHours: 2 },
  { id: "refresh-markets", component: "Market Quotes / Indices / ETFs", tab: "Markets", metadataKey: "dashboard_snapshot:markets:latest", schedule: "Market hours", staleAfterHours: 4 },
  { id: "refresh-put-call", component: "Cboe Put/Call", tab: "Markets", schedule: "Market hours", staleAfterHours: 26 },
  { id: "refresh-news-feed", component: "Unusual Whales News Feed", tab: "News & Calendar", metadataKey: "unusual_whales_news_feed", schedule: "Every 30 minutes", staleAfterHours: 2 },
  { id: "refresh-featured-articles", component: "Unusual Whales Featured Articles", tab: "News & Calendar", metadataKey: "unusual_whales_featured_articles", schedule: "Every 30 minutes", staleAfterHours: 2 },
  { id: "refresh-economic-events", component: "Investing.com Economic Events", tab: "News & Calendar", metadataKey: "investing_economic_events", schedule: "Weekdays", staleAfterHours: 26 },
  { id: "fetch-uw-earnings", component: "Earnings Calendar", tab: "News & Calendar", metadataKey: "unusual_whales_earnings", schedule: "Every minute", staleAfterHours: 2 },
  { id: "refresh-dark-pool", component: "Dark Pool", tab: "Flow", metadataKey: "unusual_whales_dark_pool_flows", schedule: "Daily", staleAfterHours: 36 },
  { id: "refresh-whale-feed", component: "Whale Feed", tab: "Flow", metadataKey: "unusual_whales_whale_feed", schedule: "Weekdays", staleAfterHours: 36 },
  { id: "refresh-insider-trades", component: "Insider Trades", tab: "Flow", metadataKey: "unusual_whales_insider_trades", schedule: "Daily", staleAfterHours: 36 },
  { id: "refresh-flow", component: "Flow Snapshot", tab: "Flow", metadataKey: "dashboard_snapshot:flow:latest", schedule: "Daily", staleAfterHours: 36 },
  { id: "refresh-ownership", component: "Institutional / 13F", tab: "Ownership", metadataKey: "dashboard_snapshot:ownership:latest", schedule: "Daily fixture-backed snapshot", staleAfterHours: 48 },
  { id: "refresh-ownership", component: "Congressional Trades", tab: "Ownership", metadataKey: "dashboard_snapshot:ownership:latest", schedule: "Daily fixture-backed snapshot", staleAfterHours: 48 },
  { id: "refresh-economy", component: "Economy & Sentiment Snapshot", tab: "Economy & Sentiment", schedule: "Manual / on demand" },
  { id: "refresh-ticker", component: "Ticker Explorer Snapshot", tab: "Ticker Explorer", schedule: "Manual / on demand" }
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
    return STATUS_JOBS.map((job) => ({ ...job, status: "Unknown", lastRun: "—", nextRun: job.schedule || "—", error: null }));
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
      nextRun: job.schedule || "—",
      error: row?.error ?? null
    };
  });
}
