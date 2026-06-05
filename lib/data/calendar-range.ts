export const calendarRangeKeys = ["last-week", "this-week", "next-week"] as const;

export type CalendarRangeKey = (typeof calendarRangeKeys)[number];

export type CalendarRange = {
  key: CalendarRangeKey;
  label: string;
  minDate: string;
  maxDate: string;
};

const rangeLabels: Record<CalendarRangeKey, string> = {
  "last-week": "Last week",
  "this-week": "This week",
  "next-week": "Next week"
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDays(utcDate, -daysSinceMonday);
}

export function parseCalendarRangeKey(value?: string | null): CalendarRangeKey {
  return calendarRangeKeys.includes(value as CalendarRangeKey)
    ? (value as CalendarRangeKey)
    : "this-week";
}

export function getCalendarRange(key: CalendarRangeKey, baseDate = new Date()): CalendarRange {
  const weekOffset = key === "last-week" ? -7 : key === "next-week" ? 7 : 0;
  const start = addDays(startOfWeek(baseDate), weekOffset);
  const end = addDays(start, 5);

  return {
    key,
    label: rangeLabels[key],
    minDate: dateOnly(start),
    maxDate: dateOnly(end)
  };
}

export function isDateInCalendarRange(date: string | undefined, range: CalendarRange) {
  return Boolean(date && date >= range.minDate && date <= range.maxDate);
}
