export const TORONTO_TIME_ZONE = "America/Toronto";

const ET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TORONTO_TIME_ZONE
});

const ET_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: TORONTO_TIME_ZONE
});


const ET_COMPACT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TORONTO_TIME_ZONE
});

const ET_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TORONTO_TIME_ZONE
});

function normalizeTimeParts(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*(?:ET|EST|EDT)?$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const explicitPeriod = match[3]?.toUpperCase();
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

  const period = explicitPeriod ?? (hour >= 12 ? "PM" : "AM");
  const displayHour = explicitPeriod ? hour : hour % 12 || 12;
  return `${displayHour}:${minute} ${period} ET`;
}

export function formatEtTime(timestamp?: string | number | Date | null): string {
  if (timestamp === null || timestamp === undefined || timestamp === "") return "—";

  if (typeof timestamp === "string") {
    const normalized = normalizeTimeParts(timestamp);
    if (normalized) return normalized;
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return String(timestamp);

  return `${ET_TIME_FORMATTER.format(date).replace("a.m.", "AM").replace("p.m.", "PM")} ET`;
}

export function formatEtDateKey(timestamp?: string | number | Date | null): string | null {
  if (timestamp === null || timestamp === undefined || timestamp === "") return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return ET_DATE_KEY_FORMATTER.format(date);
}

export function formatEtDate(timestamp?: string | number | Date | null): string {
  if (timestamp === null || timestamp === undefined || timestamp === "") return "—";
  const value =
    typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)
      ? `${timestamp}T12:00:00Z`
      : timestamp;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(timestamp);
  return ET_DATE_FORMATTER.format(date);
}

export function formatEtDateTime(timestamp?: string | number | Date | null): string {
  if (timestamp === null || timestamp === undefined || timestamp === "") return "—";

  if (typeof timestamp === "string" && normalizeTimeParts(timestamp))
    return formatEtTime(timestamp);

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return String(timestamp);

  return `${ET_DATE_FORMATTER.format(date)}, ${formatEtTime(date)}`;
}

export function timestampTitle(timestamp?: string | number | Date | null): string | undefined {
  if (timestamp === null || timestamp === undefined || timestamp === "") return undefined;
  if (timestamp instanceof Date) return timestamp.toISOString();
  return String(timestamp);
}

export function formatDarkPoolExecutedAt(timestamp?: string | number | Date | null): string {
  if (timestamp === null || timestamp === undefined || timestamp === "") return "—";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return String(timestamp);
  return ET_COMPACT_DATE_TIME_FORMATTER.format(date).replace(",", "");
}


export const formatTorontoTime = formatEtTime;
export const formatTorontoDateKey = formatEtDateKey;
export const formatTorontoDate = formatEtDate;
export const formatTorontoDateTime = formatEtDateTime;
export const formatTorontoCompactDateTime = formatDarkPoolExecutedAt;
