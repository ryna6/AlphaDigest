import { TORONTO_TIME_ZONE } from "../utils/time";

export type TorontoWindow = {
  day?: number;
  startTime: string;
  endTime: string;
};

export type TorontoRunWindowOptions = {
  now?: Date;
  days?: number[];
  windows?: TorontoWindow[];
  startTime?: string;
  endTime?: string;
  intervalMinutes?: number;
  minuteOffset?: number;
  hours?: number[];
  minutes?: number[];
};

export type TorontoRunDecision = {
  shouldRun: boolean;
  reason: string;
  torontoTime: string;
};

type TorontoParts = {
  day: number;
  hour: number;
  minute: number;
  label: string;
};

const TORONTO_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: TORONTO_TIME_ZONE
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function formatterValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getTorontoParts(date = new Date()): TorontoParts {
  const parts = TORONTO_PARTS_FORMATTER.formatToParts(date);
  const weekday = formatterValue(parts, "weekday");
  const year = formatterValue(parts, "year");
  const month = formatterValue(parts, "month");
  const dayOfMonth = formatterValue(parts, "day");
  const hour = Number(formatterValue(parts, "hour"));
  const minute = Number(formatterValue(parts, "minute"));
  const second = formatterValue(parts, "second");
  return {
    day: WEEKDAY_INDEX[weekday] ?? date.getUTCDay(),
    hour,
    minute,
    label: `${weekday} ${year}-${month}-${dayOfMonth} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${second}`
  };
}

function minutesFromTime(value: string) {
  const [hour, minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function matchesWindow(parts: TorontoParts, options: TorontoRunWindowOptions) {
  const minuteOfDay = parts.hour * 60 + parts.minute;
  const windows = options.windows?.length
    ? options.windows
    : options.startTime && options.endTime
      ? [{ startTime: options.startTime, endTime: options.endTime }]
      : [];

  if (windows.length > 0) {
    return windows.some((window) => {
      if (window.day !== undefined && window.day !== parts.day) return false;
      return minuteOfDay >= minutesFromTime(window.startTime) && minuteOfDay <= minutesFromTime(window.endTime);
    });
  }

  return true;
}

export function shouldRunInTorontoWindow(options: TorontoRunWindowOptions = {}): TorontoRunDecision {
  const parts = getTorontoParts(options.now ?? new Date());
  const minuteOffset = options.minuteOffset ?? 0;

  if (options.days?.length && !options.days.includes(parts.day)) {
    return { shouldRun: false, reason: "outside_toronto_days", torontoTime: parts.label };
  }

  if (!matchesWindow(parts, options)) {
    return { shouldRun: false, reason: "outside_toronto_window", torontoTime: parts.label };
  }

  if (options.hours?.length && !options.hours.includes(parts.hour)) {
    return { shouldRun: false, reason: "outside_toronto_hours", torontoTime: parts.label };
  }

  if (options.minutes?.length && !options.minutes.includes(parts.minute)) {
    return { shouldRun: false, reason: "outside_toronto_minutes", torontoTime: parts.label };
  }

  if (options.intervalMinutes) {
    const minuteOfDay = parts.hour * 60 + parts.minute;
    const windowStart = options.windows?.find((window) => window.day === undefined || window.day === parts.day)?.startTime ?? options.startTime ?? "00:00";
    const elapsed = minuteOfDay - minutesFromTime(windowStart);
    if (elapsed < 0 || elapsed % options.intervalMinutes !== 0 || parts.minute % 5 !== minuteOffset % 5) {
      return { shouldRun: false, reason: "outside_toronto_interval", torontoTime: parts.label };
    }
  }

  return { shouldRun: true, reason: "scheduled_toronto_window", torontoTime: parts.label };
}

export function nextTorontoRun(options: TorontoRunWindowOptions = {}, from = new Date()) {
  const next = new Date(from.getTime() + 60_000);
  next.setUTCSeconds(0, 0);
  const deadline = from.getTime() + 14 * 24 * 60 * 60 * 1000;
  while (next.getTime() <= deadline) {
    if (shouldRunInTorontoWindow({ ...options, now: next }).shouldRun) return next;
    next.setUTCMinutes(next.getUTCMinutes() + 1);
  }
  return null;
}
