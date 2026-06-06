import type { UnusualWhalesEarningsEvent } from "@/lib/data/schemas/dashboard";

export const EARNINGS_MIN_MARKET_CAP = 5_000_000_000;

type EarningsSession = "premarket" | "postmarket" | "regular" | "unknown";

export function getSelectedDayEarnings(events: UnusualWhalesEarningsEvent[], selectedDate: string) {
  return events.filter((event) => event.reportDate === selectedDate);
}

export function filterMajorEarnings(events: UnusualWhalesEarningsEvent[]) {
  return events.filter((event) => (event.marketCap ?? 0) >= EARNINGS_MIN_MARKET_CAP);
}

export function sortByMarketCapDesc(events: UnusualWhalesEarningsEvent[]) {
  return [...events].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
}

export function getTopMarketCapEarnings(events: UnusualWhalesEarningsEvent[], limit: number) {
  return sortByMarketCapDesc(filterMajorEarnings(events)).slice(0, limit);
}

export function earningsSessionForReportTime(
  reportTime: string | null | undefined
): EarningsSession {
  switch (reportTime?.toLowerCase()) {
    case "premarket":
      return "premarket";
    case "postmarket":
      return "postmarket";
    case "regular":
      return "regular";
    default:
      return "unknown";
  }
}

export function groupEarningsBySession(events: UnusualWhalesEarningsEvent[]) {
  const groups: Record<EarningsSession, UnusualWhalesEarningsEvent[]> = {
    premarket: [],
    postmarket: [],
    regular: [],
    unknown: []
  };

  for (const event of events) groups[earningsSessionForReportTime(event.reportTime)].push(event);
  return groups;
}

export function reportTimeDisplayLabel(reportTime: string | null | undefined) {
  switch (earningsSessionForReportTime(reportTime)) {
    case "premarket":
      return "Before Open";
    case "postmarket":
      return "After Close";
    case "regular":
      return "Regular";
    default:
      return "—";
  }
}

export function getMajorEarningsForDate(
  events: UnusualWhalesEarningsEvent[],
  selectedDate: string,
  limit?: number
) {
  const sorted = sortByMarketCapDesc(
    filterMajorEarnings(getSelectedDayEarnings(events, selectedDate))
  );
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}
