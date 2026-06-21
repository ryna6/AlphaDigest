import { createServerSupabaseClient } from "@/lib/db/supabase";
import { TORONTO_TIME_ZONE } from "@/lib/utils/time";

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
  metadataKey?: string;
  lastRunTable?: string;
  frequency: string;
  schedule?: string;
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
  { id: "today-market-overview", group: "Today", job: "Market Overview", functionName: "refresh-market-quotes", metadataKey: "yahoo_market_quotes", frequency: "Every 15m / market hours", schedule: "*/15 14-22 * * 1-5", staleAfterHours: 4 },
  { id: "today-put-call-ratio", group: "Today", job: "Put/Call Ratio", functionName: "refresh-put-call", lastRunTable: "put_call_observations", frequency: "Every 30m / market hours", schedule: "5,35 14-21 * * 1-5", staleAfterHours: 26 },
  { id: "today-top-news", group: "Today", job: "Top News", functionName: "refresh-featured-articles", metadataKey: "unusual_whales_featured_articles", frequency: "Every 30m", schedule: "20,50 * * * *", staleAfterHours: 2 },
  { id: "today-economic-events", group: "Today", job: "Today’s Economic Events", functionName: "refresh-economic-events", metadataKey: "investing_economic_events", frequency: "Weekdays 7:05 AM, 11:05 AM, 5:05 PM", schedule: "5 11,15,21 * * 1-5", staleAfterHours: 26 },
  { id: "today-earnings", group: "Today", job: "Today’s Earnings", functionName: "fetch-uw-earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 1m", schedule: "* * * * *", staleAfterHours: 2 },
  { id: "markets-indices-heatmaps", group: "Markets", job: "Indices/Heatmaps", functionName: "refresh-markets", metadataKey: "dashboard_snapshot:markets:latest", frequency: "Every 10m / market hours", schedule: "*/10 14-22 * * 1-5", staleAfterHours: 4 },
  { id: "markets-breadth", group: "Markets", job: "Market Breadth", functionName: "TBD", frequency: "TBD" },
  { id: "markets-movers", group: "Markets", job: "Movers / Leaders / Laggards", functionName: "TBD", frequency: "TBD" },
  { id: "news-calendar-news-feed", group: "News & Calendar", job: "Unusual Whales News Feed", functionName: "refresh-news-feed", metadataKey: "unusual_whales_news_feed", frequency: "Every 30m", schedule: "10,40 * * * *", staleAfterHours: 2 },
  { id: "news-calendar-economic-events", group: "News & Calendar", job: "Economic Events", functionName: "refresh-economic-events", metadataKey: "investing_economic_events", frequency: "Weekdays 7:05 AM, 11:05 AM, 5:05 PM", schedule: "5 11,15,21 * * 1-5", staleAfterHours: 26 },
  { id: "news-calendar-earnings", group: "News & Calendar", job: "Earnings Calendar", functionName: "fetch-uw-earnings", metadataKey: "unusual_whales_earnings", frequency: "Every 1m", schedule: "* * * * *", staleAfterHours: 2 },
  { id: "flow-insider-trades", group: "Flow", job: "Insider Trades", functionName: "refresh-insider-trades", metadataKey: "unusual_whales_insider_trades", frequency: "Daily", schedule: "30 9 * * *", staleAfterHours: 36 },
  { id: "flow-dark-pool", group: "Flow", job: "Dark Pool", functionName: "refresh-dark-pool", metadataKey: "unusual_whales_dark_pool_flows", frequency: "Daily", schedule: "15 9 * * *", staleAfterHours: 36 },
  { id: "flow-whale-feed", group: "Flow", job: "Whale Feed", functionName: "refresh-whale-feed", metadataKey: "unusual_whales_whale_feed", frequency: "Weekdays", schedule: "30 9 * * 1-5", staleAfterHours: 36 },
  { id: "flow-snapshot", group: "Flow", job: "Flow Snapshot", functionName: "refresh-flow", metadataKey: "dashboard_snapshot:flow:latest", frequency: "Daily", schedule: "45 9 * * *", staleAfterHours: 36 },
  { id: "ownership-institutional", group: "Ownership", job: "Institutional", functionName: "TBD", frequency: "TBD" },
  { id: "ownership-congressional-trades", group: "Ownership", job: "Congressional Trades", functionName: "TBD", frequency: "TBD" },
  { id: "economy-sentiment-tbd", group: "Economy & Sentiment", job: "TBD", functionName: "TBD", frequency: "TBD" }
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

function cronFieldMatches(field: string, value: number) {
  if (field === "*") return true;
  return field.split(",").some((part) => {
    if (part.startsWith("*/")) {
      const step = Number(part.slice(2));
      return Number.isFinite(step) && step > 0 && value % step === 0;
    }
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      return Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end;
    }
    return Number(part) === value;
  });
}

function nextScheduledRun(schedule?: string) {
  if (!schedule) return "—";
  const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.trim().split(/\s+/);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return "—";
  const next = new Date(Date.now() + 60_000);
  next.setUTCSeconds(0, 0);
  const deadline = Date.now() + 8 * 24 * 60 * 60 * 1000;
  while (next.getTime() <= deadline) {
    if (
      cronFieldMatches(minute, next.getUTCMinutes()) &&
      cronFieldMatches(hour, next.getUTCHours()) &&
      cronFieldMatches(dayOfMonth, next.getUTCDate()) &&
      cronFieldMatches(month, next.getUTCMonth() + 1) &&
      cronFieldMatches(dayOfWeek, next.getUTCDay())
    ) {
      return formatStatusDateTime(next);
    }
    next.setUTCMinutes(next.getUTCMinutes() + 1);
  }
  return "—";
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
    return STATUS_JOBS.map((job) => ({ ...job, status: "Unknown", lastRun: "—", nextRun: nextScheduledRun(job.schedule), error: null }));
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
      nextRun: nextScheduledRun(job.schedule),
      error: row?.error ?? null
    };
  });
}
