export const INSIDER_TRADES_LOOKBACK_MONTHS = 6;

export function getInsiderWindowStartDate(months = INSIDER_TRADES_LOOKBACK_MONTHS, referenceDate = new Date()) {
  const date = new Date(referenceDate);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}
