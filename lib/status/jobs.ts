import { createServerSupabaseClient } from "@/lib/db/supabase";
import { TORONTO_TIME_ZONE } from "@/lib/utils/time";
import { nextTorontoRun, type TorontoRunWindowOptions } from "@/lib/schedule/toronto";

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
  functionName: string | "TBD";
  endpoint: string | "TBD" | "—";
  metadataKey?: string;
  lastRunTable?: string;
  frequency: string;
  schedule?: string;
  scheduleDescription?: string;
  nextRunRule?: TorontoRunWindowOptions;
  enabled?: boolean;
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

export const STATUS_GROUPS: StatusGroup[] = [
  "Today",
  "Markets",
  "News & Calendar",
  "Flow",
  "Ownership",
  "Economy & Sentiment"
];

export const STATUS_JOBS: StatusJob[] = [
  { id: "today-market-overview", group: "Today", job: "Market Overview", functionName: "refresh-market-quotes", endpoint: "Yahoo market quotes", metadataKey: "yahoo_market_quotes", frequency: "Every 5m, Sun 6 PM–Fri 5 PM", schedule: "*/5 * * * 0-5", scheduleDescription: "Exact guarded Toronto window: Sunday 6 PM-8 PM, Monday-Thursday 4 AM-8 PM, Friday 4 AM-5 PM.", nextRunRule: { windows: [{ day: 0, startTime: "18:00", endTime: "20:00" }, { day: 1, startTime: "04:00", endTime: "20:00" }, { day: 2, startTime: "04:00", endTime: "20:00" }, { day: 3, startTime: "04:00", endTime: "20:00" }, { day: 4, startTime: "04:00", endTime: "20:00" }, { day: 5, startTime: "04:00", endTime: "17:00" }], intervalMinutes: 5, minuteOffset: 0 }, staleAfterHours: 4 },
  { id: "today-put-call-ratio", group: "Today", job: "Put/Call Ratio", functionName: "refresh-put-call", endpoint: "Cboe Put/Call", lastRunTable: "put_call_observations", frequency: "Every 30m / market hours", schedule: "5,35 14-21 * * 1-5", staleAfterHours: 26 },
  { id: "today-top-news", group: "Today", job: "Top News", functionName: "refresh-featured-articles", endpoint: "Unusual Whales Featured Articles", metadataKey: "unusual_whales_featured_articles", frequency: "Every 30m", schedule: "0,30 * * * *", nextRunRule: { intervalMinutes: 30, minuteOffset: 0 }, staleAfterHours: 2 },
  { id: "today-economic-events", group: "Today", job: "Today’s Economic Events", functionName: "refresh-economic-events", endpoint: "Investing.com Economic Calendar", metadataKey: "investing_economic_events", frequency: "Every 12h", schedule: "0 * * * *", scheduleDescription: "Hourly UTC wake with Toronto runtime guard for 6:00 AM and 6:00 PM.", nextRunRule: { hours: [6, 18], minutes: [0] }, staleAfterHours: 26 },
  { id: "today-earnings", group: "Today", job: "Today’s Earnings", functionName: "fetch-uw-earnings", endpoint: "Unusual Whales Earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 30m, 2–6 PM", schedule: "0,30 * * * *", scheduleDescription: "Every 30 minutes with Toronto runtime guard from 2:00 PM through 6:00 PM.", nextRunRule: { startTime: "14:00", endTime: "18:00", intervalMinutes: 30, minuteOffset: 0 }, staleAfterHours: 26 },
  { id: "markets-indices-heatmaps", group: "Markets", job: "Indices/Heatmaps", functionName: "refresh-markets", endpoint: "Yahoo market data", metadataKey: "dashboard_snapshot:markets:latest", frequency: "Every 5m, Mon–Fri 9 AM–4 PM", schedule: "*/5 * * * 1-5", scheduleDescription: "Every 5 minutes with Toronto runtime guard Monday-Friday 9:00 AM-4:00 PM.", nextRunRule: { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "16:00", intervalMinutes: 5, minuteOffset: 0 }, staleAfterHours: 4 },
  { id: "markets-breadth", group: "Markets", job: "Market Breadth", functionName: "TBD", endpoint: "TBD", frequency: "TBD" },
  { id: "markets-movers", group: "Markets", job: "Movers / Leaders / Laggards", functionName: "TBD", endpoint: "TBD", frequency: "TBD" },
  { id: "news-calendar-news-feed", group: "News & Calendar", job: "Unusual Whales News Feed", functionName: "refresh-news-feed", endpoint: "Unusual Whales News Feed", metadataKey: "unusual_whales_news_feed", frequency: "Every 30m", schedule: "10,40 * * * *", staleAfterHours: 2 },
  { id: "news-calendar-economic-events", group: "News & Calendar", job: "Economic Events", functionName: "refresh-economic-events", endpoint: "Investing.com Economic Calendar", metadataKey: "investing_economic_events", frequency: "Every 12h", schedule: "0 * * * *", scheduleDescription: "Hourly UTC wake with Toronto runtime guard for 6:00 AM and 6:00 PM.", nextRunRule: { hours: [6, 18], minutes: [0] }, staleAfterHours: 26 },
  { id: "news-calendar-earnings", group: "News & Calendar", job: "Earnings Calendar", functionName: "fetch-uw-earnings", endpoint: "Unusual Whales Earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 30m, 2–6 PM", schedule: "0,30 * * * *", scheduleDescription: "Every 30 minutes with Toronto runtime guard from 2:00 PM through 6:00 PM.", nextRunRule: { startTime: "14:00", endTime: "18:00", intervalMinutes: 30, minuteOffset: 0 }, staleAfterHours: 26 },
  { id: "flow-insider-trades", group: "Flow", job: "Insider Trades", functionName: "refresh-insider-trades", endpoint: "Unusual Whales Insider Trades", metadataKey: "unusual_whales_insider_trades", frequency: "Every 2h", schedule: "0 * * * *", scheduleDescription: "Hourly UTC wake with Toronto runtime guard every 2 hours.", nextRunRule: { intervalMinutes: 120, minuteOffset: 0 }, staleAfterHours: 36 },
  { id: "flow-dark-pool", group: "Flow", job: "Dark Pool", functionName: "refresh-dark-pool", endpoint: "Unusual Whales Dark Pool", metadataKey: "unusual_whales_dark_pool_flows", frequency: "Every 2h, Mon–Fri 4 AM–8 PM", schedule: "0 * * * 1-5", scheduleDescription: "Hourly UTC wake with Toronto runtime guard every 2 hours Monday-Friday 4:00 AM-8:00 PM.", nextRunRule: { days: [1, 2, 3, 4, 5], startTime: "04:00", endTime: "20:00", intervalMinutes: 120, minuteOffset: 0 }, staleAfterHours: 36 },
  { id: "flow-whale-feed", group: "Flow", job: "Whale Feed", functionName: "refresh-whale-feed", endpoint: "Unusual Whales Whale Feed", metadataKey: "unusual_whales_whale_feed", frequency: "Every 2h, Mon–Fri 4 AM–8 PM", schedule: "0 * * * 1-5", scheduleDescription: "Hourly UTC wake with Toronto runtime guard every 2 hours Monday-Friday 4:00 AM-8:00 PM.", nextRunRule: { days: [1, 2, 3, 4, 5], startTime: "04:00", endTime: "20:00", intervalMinutes: 120, minuteOffset: 0 }, staleAfterHours: 36 },
  { id: "flow-snapshot", group: "Flow", job: "Flow Snapshot", functionName: "refresh-flow", endpoint: "Supabase Flow Snapshot", metadataKey: "dashboard_snapshot:flow:latest", frequency: "Every 2h, Mon–Fri 4:05 AM–8:05 PM", schedule: "5 * * * 1-5", scheduleDescription: "Hourly UTC wake with Toronto runtime guard every 2 hours Monday-Friday 4:05 AM-8:05 PM, offset after Flow source jobs.", nextRunRule: { days: [1, 2, 3, 4, 5], startTime: "04:05", endTime: "20:05", intervalMinutes: 120, minuteOffset: 5 }, staleAfterHours: 36 },
  { id: "ownership-institutional", group: "Ownership", job: "Institutional", functionName: "TBD", endpoint: "TBD", frequency: "TBD" },
  { id: "ownership-congressional-trades", group: "Ownership", job: "Congressional Trades", functionName: "TBD", endpoint: "TBD", frequency: "TBD" },
  { id: "economy-sentiment-tbd", group: "Economy & Sentiment", job: "TBD", functionName: "TBD", endpoint: "TBD", frequency: "TBD" }
];

const STATUS_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TORONTO_TIME_ZONE
});

function formatStatusDateTime(timestamp?: string | number | Date | null): string {
  if (timestamp === null || timestamp === undefined || timestamp === "") return "—";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return String(timestamp);
  return STATUS_TIME_FORMATTER.format(date).replace("a.m.", "AM").replace("p.m.", "PM");
}

function nextScheduledRun(job: StatusJob) {
  const next = job.nextRunRule ? nextTorontoRun(job.nextRunRule) : null;
  return next ? formatStatusDateTime(next) : "—";
}

function statusFor(job: StatusJob, metadata?: MetadataRow): StatusValue {
  if (job.functionName === "TBD" || !job.metadataKey || !metadata) return "Unknown";
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
    return STATUS_JOBS.map((job) => ({ ...job, status: "Unknown", lastRun: "—", nextRun: nextScheduledRun(job), error: null }));
  }

  const keys = Array.from(new Set(STATUS_JOBS.map((job) => job.metadataKey).filter(Boolean))) as string[];
  const { data } = await supabase.client
    .from("data_refresh_metadata")
    .select("source,ok,fetched_at,updated_at,error")
    .in("source", keys);
  const metadata = new Map((data ?? []).map((row) => [row.source, row as MetadataRow]));

  const tableLastRuns = new Map<string, string>();
  const tableNames = Array.from(new Set(STATUS_JOBS.map((job) => job.lastRunTable).filter(Boolean))) as string[];
  await Promise.all(tableNames.map(async (table) => {
    const { data: latest } = await supabase.client
      .from(table)
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.fetched_at) tableLastRuns.set(table, latest.fetched_at);
  }));

  return STATUS_JOBS.map((job) => {
    const row = job.metadataKey ? metadata.get(job.metadataKey) : undefined;
    const lastTimestamp = row?.fetched_at ?? row?.updated_at ?? (job.lastRunTable ? tableLastRuns.get(job.lastRunTable) : null) ?? null;
    return {
      ...job,
      status: statusFor(job, row),
      lastRun: lastTimestamp ? formatStatusDateTime(lastTimestamp) : "—",
      nextRun: nextScheduledRun(job),
      error: row?.error ?? null
    };
  });
}
