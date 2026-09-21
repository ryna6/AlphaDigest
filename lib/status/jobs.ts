import { createServerSupabaseClient } from "@/lib/db/supabase";
import { TORONTO_TIME_ZONE } from "@/lib/utils/time";
import {
  getTorontoParts,
  nextTorontoRun,
  shouldRunInTorontoWindow,
  type TorontoRunWindowOptions
} from "@/lib/schedule/toronto";

export type StatusValue = "Healthy" | "Warning" | "Idle" | "Offline" | "Error" | "Unknown";

export type StatusGroup =
  "Today" | "Markets" | "News & Calendar" | "Flow" | "Ownership" | "Sentiment";

export type StatusJob = {
  id: string;
  group: StatusGroup;
  job: string;
  functionName: string | "TBD";
  source: string | "TBD" | "—";
  frequency: string;
  schedule?: string;
  scheduleDescription?: string;
  nextRunRule?: TorontoRunWindowOptions;
  nextRunUtcRule?: { hours: number[]; minutes: number[] };
  enabled?: boolean;
  staleAfterMinutes?: number;
};

export type StatusRow = StatusJob & {
  status: StatusValue;
  lastRun: string;
  nextRun: string;
  rowsFetched: number | null;
  rowsInserted: number | null;
  rowsUpdated: number | null;
  errorMessage: string | null;
  warningMessage: string | null;
};

export type StatusRowsResult = {
  rows: StatusRow[];
  supabaseReadHealth: SupabaseReadHealth;
};

export type SupabaseReadHealth = {
  status: "healthy" | "error";
  checkedAt: string;
  error: string | null;
};

type JobRunRow = {
  function_name: string;
  status: "running" | "success" | "warning" | "error" | "skipped";
  started_at: string;
  finished_at: string | null;
  rows_fetched: number | null;
  rows_inserted: number | null;
  rows_updated: number | null;
  error_message: string | null;
  warning_message: string | null;
};

export const STATUS_GROUPS: StatusGroup[] = [
  "Today",
  "Markets",
  "News & Calendar",
  "Flow",
  "Ownership",
  "Sentiment"
];

export const STATUS_JOBS: StatusJob[] = [
  {
    id: "today-market-overview",
    group: "Today",
    job: "Market Overview",
    functionName: "refresh-market-quotes",
    source: "Finnhub",
    frequency: "Every 5m, Sun–Fri",
    schedule: "*/5 * * * *",
    scheduleDescription:
      "Every 5 minutes from the start of Sunday through the end of Friday in Toronto/Eastern time.",
    nextRunRule: { days: [0, 1, 2, 3, 4, 5], intervalMinutes: 5, minuteOffset: 0 },
    staleAfterMinutes: 15
  },
  {
    id: "today-put-call-ratio",
    group: "Today",
    job: "Put/Call Ratio",
    functionName: "refresh-put-call",
    source: "Cboe",
    frequency: "Every 30m, Mon–Fri",
    schedule: "*/30 * * * 1-5",
    scheduleDescription: "Every 30 minutes on the hour and half-hour, Monday to Friday only.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 30, minuteOffset: 0 },
    staleAfterMinutes: 60
  },
  {
    id: "today-top-news",
    group: "Today",
    job: "Top News",
    functionName: "refresh-featured-articles",
    source: "Unusual Whales",
    frequency: "Every 30m, Daily",
    schedule: "7,37 * * * *",
    scheduleDescription: "Every 30 minutes at :07 and :37, every day.",
    nextRunRule: { intervalMinutes: 30, minuteOffset: 7 },
    staleAfterMinutes: 60
  },
  {
    id: "today-economic-events",
    group: "Today",
    job: "Today’s Economic Events",
    functionName: "refresh-economic-events",
    source: "Investing.com",
    frequency: "Every 6h, Daily",
    staleAfterMinutes: 480,
    schedule: "10 */6 * * *",
    scheduleDescription: "Every 6 hours at 10 minutes past the UTC boundary.",
    nextRunUtcRule: { hours: [0, 6, 12, 18], minutes: [10] }
  },
  {
    id: "today-earnings",
    group: "Today",
    job: "Today’s Earnings",
    functionName: "fetch-uw-earnings",
    source: "Unusual Whales",
    frequency: "Every 6h, Daily",
    schedule: "0 */6 * * *",
    scheduleDescription: "Every 6 hours daily.",
    nextRunUtcRule: { hours: [0, 6, 12, 18], minutes: [0] },
    staleAfterMinutes: 480
  },
  {
    id: "markets-indices-heatmaps",
    group: "Markets",
    job: "Indices/Heatmaps",
    functionName: "refresh-markets",
    source: "Yahoo Finance, Finnhub",
    frequency: "Every 5m, Mon–Fri",
    schedule: "*/5 * * * 1-5",
    scheduleDescription: "Every 5 minutes Monday-Friday.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 5, minuteOffset: 0 },
    staleAfterMinutes: 15
  },
  {
    id: "markets-sp500-heatmap",
    group: "Markets",
    job: "S&P 500 Heatmap",
    functionName: "refresh-markets-heatmap",
    source: "Unusual Whales",
    frequency: "Every 10m, Mon–Fri",
    schedule: "*/10 * * * 1-5",
    scheduleDescription: "Every 10 minutes Monday-Friday.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 10, minuteOffset: 0 },
    staleAfterMinutes: 20
  },
  {
    id: "markets-daily-candles",
    group: "Markets",
    job: "Daily Market Candles",
    functionName: "refresh-daily-market-candles",
    source: "Finnhub",
    frequency: "Daily, Mon–Fri",
    schedule: "0 23 * * 1-5",
    scheduleDescription:
      "Daily at 23:00 UTC Monday-Friday (6:00 PM America/Toronto during standard time; 7:00 PM during daylight time) and invokes the background worker.",
    nextRunRule: { days: [1, 2, 3, 4, 5], utcHours: [23], minutes: [0] },
    staleAfterMinutes: 1440
  },
  {
    id: "markets-daily-crypto-candles",
    group: "Markets",
    job: "Daily Crypto Candles",
    functionName: "refresh-daily-crypto-candles",
    source: "Unusual Whales",
    frequency: "Daily",
    schedule: "0 6 * * *",
    scheduleDescription:
      "Daily at 06:00 UTC (1:00 AM America/Toronto during standard time; 2:00 AM during daylight time).",
    nextRunRule: { utcHours: [6], minutes: [0] },
    staleAfterMinutes: 1440
  },
  {
    id: "markets-movers",
    group: "Markets",
    job: "Market Movers",
    functionName: "refresh-markets-heatmap",
    source: "Unusual Whales",
    frequency: "Every 10m, Mon–Fri",
    schedule: "*/10 * * * 1-5",
    scheduleDescription: "Every 10 minutes Monday-Friday via refresh-markets-heatmap.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 10, minuteOffset: 0 },
    staleAfterMinutes: 20
  },
  {
    id: "news-calendar-news-feed",
    group: "News & Calendar",
    job: "Unusual Whales News Feed",
    functionName: "refresh-news-feed",
    source: "Unusual Whales",
    frequency: "Every 30m, Daily",
    schedule: "6,36 * * * *",
    scheduleDescription: "Every 30 minutes at :06 and :36, every day.",
    nextRunRule: { intervalMinutes: 30, minuteOffset: 6 },
    staleAfterMinutes: 60
  },
  {
    id: "news-calendar-economic-events",
    group: "News & Calendar",
    job: "Economic Events",
    functionName: "refresh-economic-events",
    source: "Investing.com",
    frequency: "Every 6h, Daily",
    staleAfterMinutes: 480,
    schedule: "10 */6 * * *",
    scheduleDescription: "Every 6 hours at 10 minutes past the UTC boundary.",
    nextRunUtcRule: { hours: [0, 6, 12, 18], minutes: [10] }
  },
  {
    id: "news-calendar-economic-events-next-week",
    group: "News & Calendar",
    job: "Next Week Economic Events",
    functionName: "refresh-economic-events-next-week",
    source: "Investing.com",
    frequency: "Daily",
    staleAfterMinutes: 1560,
    schedule: "40 1 * * *",
    scheduleDescription: "Daily at 01:40 UTC, staggered from current-week refreshes.",
    nextRunUtcRule: { hours: [1], minutes: [40] }
  },
  {
    id: "news-calendar-earnings",
    group: "News & Calendar",
    job: "Earnings Calendar",
    functionName: "fetch-uw-earnings",
    source: "Unusual Whales",
    frequency: "Every 6h, Daily",
    schedule: "0 */6 * * *",
    scheduleDescription: "Every 6 hours daily.",
    nextRunUtcRule: { hours: [0, 6, 12, 18], minutes: [0] },
    staleAfterMinutes: 480
  },
  {
    id: "flow-insider-trades",
    group: "Flow",
    job: "Insider Trades",
    functionName: "refresh-insider-trades",
    source: "Unusual Whales",
    frequency: "Every 1h, Mon–Fri",
    schedule: "3 * * * *",
    scheduleDescription: "Every hour at :03, with a Toronto weekday runtime guard.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 60, minuteOffset: 3 },
    staleAfterMinutes: 90
  },
  {
    id: "flow-dark-pool",
    group: "Flow",
    job: "Dark Pool",
    functionName: "refresh-dark-pool",
    source: "Unusual Whales",
    frequency: "Every 1h, Mon–Fri",
    schedule: "1 * * * 1-5",
    scheduleDescription: "Every hour at :01 Monday-Friday.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 60, minuteOffset: 1 },
    staleAfterMinutes: 90
  },
  {
    id: "flow-whale-feed",
    group: "Flow",
    job: "Whale Feed",
    functionName: "refresh-whale-feed",
    source: "Unusual Whales",
    frequency: "Every 1h, Mon–Fri",
    schedule: "2 * * * 1-5",
    scheduleDescription: "Every hour at :02 Monday-Friday.",
    nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 60, minuteOffset: 2 },
    staleAfterMinutes: 90
  },
  {
    id: "ownership-institutional-summary",
    group: "Ownership",
    job: "Institutional Summary",
    functionName: "refresh-institutional-summary",
    source: "Unusual Whales",
    frequency: "Daily",
    schedule: "0 10 * * *",
    scheduleDescription: "Daily at 10:00 UTC (6:00 AM America/Toronto during daylight time).",
    nextRunUtcRule: { hours: [10], minutes: [0] },
    staleAfterMinutes: 2160
  },
  {
    id: "ownership-institutional-portfolios",
    group: "Ownership",
    job: "Institutional Holdings",
    functionName: "refresh-institutional-portfolios",
    source: "Unusual Whales",
    frequency: "Daily",
    schedule: "0 10 * * *",
    scheduleDescription: "Daily at 10:00 UTC.",
    nextRunUtcRule: { hours: [10], minutes: [0] },
    staleAfterMinutes: 2160
  },
  {
    id: "sentiment-tbd",
    group: "Sentiment",
    job: "TBD",
    functionName: "TBD",
    source: "TBD",
    frequency: "TBD"
  }
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

function nextUtcRun(rule: { hours: number[]; minutes: number[] }, from = new Date()) {
  const next = new Date(from.getTime() + 60_000);
  next.setUTCSeconds(0, 0);
  const deadline = from.getTime() + 14 * 24 * 60 * 60 * 1000;
  while (next.getTime() <= deadline) {
    if (rule.hours.includes(next.getUTCHours()) && rule.minutes.includes(next.getUTCMinutes()))
      return next;
    next.setUTCMinutes(next.getUTCMinutes() + 1);
  }
  return null;
}

function nextScheduledRun(job: StatusJob) {
  const next = job.nextRunUtcRule
    ? nextUtcRun(job.nextRunUtcRule)
    : job.nextRunRule
      ? nextTorontoRun(job.nextRunRule)
      : null;
  return next ? formatStatusDateTime(next) : "—";
}

function isStale(timestamp: string | null | undefined, staleAfterMinutes?: number, now = new Date()) {
  if (!timestamp || !staleAfterMinutes) return false;
  const ageMs = now.getTime() - new Date(timestamp).getTime();
  return Number.isFinite(ageMs) && ageMs > staleAfterMinutes * 60 * 1000;
}

function isIdleWindow(job: StatusJob, now: Date) {
  if (!job.nextRunRule) return false;
  if (!shouldRunInTorontoWindow({ ...job.nextRunRule, now }).shouldRun) return true;

  // An interval job has no expected run before its first offset on an active day.
  const parts = getTorontoParts(now);
  const start = job.nextRunRule.startTime?.split(":").map(Number) ?? [0, 0];
  const firstMinute = start[0] * 60 + start[1] + (job.nextRunRule.minuteOffset ?? 0);
  return Boolean(job.nextRunRule.intervalMinutes && parts.hour * 60 + parts.minute < firstMinute);
}

/** Explicit failures take precedence; idle only describes healthy scheduled inactivity. */
export function classifyStatusJob(
  job: StatusJob,
  latestRun?: JobRunRow,
  latestSuccess?: JobRunRow,
  now = new Date()
): StatusValue {
  if (job.functionName === "TBD") return "Unknown";
  if (!latestRun) return "Unknown";
  const runningAgeMs = now.getTime() - new Date(latestRun.started_at).getTime();
  if (latestRun.status === "running") return runningAgeMs > 30 * 60 * 1000 ? "Error" : "Warning";
  if (latestRun.status === "error" || latestRun.error_message) return "Error";
  if (latestRun.status === "warning") return "Warning";
  if (isIdleWindow(job, now) && latestSuccess) return "Idle";
  if (latestRun.status === "skipped") {
    if (!latestSuccess) return "Unknown";
    return isStale(latestSuccess.finished_at ?? latestSuccess.started_at, job.staleAfterMinutes, now)
      ? "Offline"
      : "Healthy";
  }
  if ((latestRun.rows_fetched ?? 1) === 0) return "Warning";
  if (
    isStale(
      latestSuccess?.finished_at ?? latestRun.finished_at ?? latestRun.started_at,
      job.staleAfterMinutes,
      now
    )
  )
    return "Offline";
  return "Healthy";
}

export async function getStatusRows(): Promise<StatusRow[]> {
  const result = await getStatusRowsWithDiagnostics();
  return result.rows;
}

export async function getStatusRowsWithDiagnostics(): Promise<StatusRowsResult> {
  const checkedAt = new Date().toISOString();
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) {
    const supabaseReadHealth: SupabaseReadHealth = {
      status: "error",
      checkedAt,
      error: supabase.message
    };
    return {
      rows: STATUS_JOBS.map((job) => ({
        ...job,
        status: "Unknown",
        lastRun: "—",
        nextRun: nextScheduledRun(job),
        rowsFetched: null,
        rowsInserted: null,
        rowsUpdated: null,
        errorMessage: null,
        warningMessage: null
      })),
      supabaseReadHealth
    };
  }

  const functionNames = Array.from(
    new Set(STATUS_JOBS.map((job) => job.functionName).filter((name) => name !== "TBD"))
  );
  const { data, error } = await supabase.client
    .from("job_runs")
    .select(
      "function_name,status,started_at,finished_at,rows_fetched,rows_inserted,rows_updated,error_message,warning_message"
    )
    .in("function_name", functionNames)
    .order("started_at", { ascending: false })
    .limit(2000);

  const supabaseReadHealth: SupabaseReadHealth = {
    status: error ? "error" : "healthy",
    checkedAt,
    error: error?.message ?? null
  };
  if (error) {
    return {
      rows: STATUS_JOBS.map((job) => ({
        ...job,
        status: "Unknown",
        lastRun: "—",
        nextRun: nextScheduledRun(job),
        rowsFetched: null,
        rowsInserted: null,
        rowsUpdated: null,
        errorMessage: null,
        warningMessage: null
      })),
      supabaseReadHealth
    };
  }

  const byFunction = new Map<string, JobRunRow[]>();
  for (const run of (data ?? []) as JobRunRow[]) {
    byFunction.set(run.function_name, [...(byFunction.get(run.function_name) ?? []), run]);
  }

  return {
    rows: STATUS_JOBS.map((job) => {
      const runs = job.functionName === "TBD" ? [] : (byFunction.get(job.functionName) ?? []);
      const latestRun = runs[0];
      const latestDisplayRun = runs.find((run) => run.status !== "skipped");
      const latestSuccess = runs.find((run) => run.status === "success");
      const lastTimestamp = latestDisplayRun
        ? (latestDisplayRun.finished_at ?? latestDisplayRun.started_at)
        : null;
      return {
        ...job,
        status: classifyStatusJob(job, latestRun, latestSuccess),
        lastRun: lastTimestamp ? formatStatusDateTime(lastTimestamp) : "—",
        nextRun: nextScheduledRun(job),
        rowsFetched: latestDisplayRun?.rows_fetched ?? null,
        rowsInserted: latestDisplayRun?.rows_inserted ?? null,
        rowsUpdated: latestDisplayRun?.rows_updated ?? null,
        errorMessage: latestDisplayRun?.error_message ?? null,
        warningMessage: latestDisplayRun?.warning_message ?? null
      };
    }),
    supabaseReadHealth
  };
}
