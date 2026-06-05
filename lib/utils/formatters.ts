export function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const format = (divisor: number, suffix: string) => {
    const scaled = abs / divisor;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 1;
    return `${sign}${scaled.toFixed(digits).replace(/\.0$/, "")}${suffix}`;
  };
  if (abs >= 1_000_000_000_000) return format(1_000_000_000_000, "T");
  if (abs >= 1_000_000_000) return format(1_000_000_000, "B");
  if (abs >= 1_000_000) return format(1_000_000, "M");
  if (abs >= 1_000) return format(1_000, "K");
  return `${value}`;
}

export function formatMarketCap(value: number | null | undefined) {
  const formatted = formatCompactNumber(value);
  return formatted === "—" ? formatted : `$${formatted}`;
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDateShort(date: string | Date | null | undefined) {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(value);
}

export function formatReportTime(reportTime: string | null | undefined) {
  switch (reportTime?.toLowerCase()) {
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
