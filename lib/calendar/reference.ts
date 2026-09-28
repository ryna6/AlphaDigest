import { formatEtDateKey } from "../utils/time";

export function addCalendarDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayForCalendarDate(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return addCalendarDays(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}

/** The calendar's effective "today", based on the Toronto date (not the browser date). */
export function economicCalendarReferenceDate(now = new Date()) {
  const actualDate = formatEtDateKey(now) ?? now.toISOString().slice(0, 10);
  const weekday = new Date(`${actualDate}T12:00:00Z`).getUTCDay();
  if (weekday === 6) return addCalendarDays(actualDate, -1);
  if (weekday === 0) return addCalendarDays(actualDate, -2);
  return actualDate;
}

export function economicCalendarWeekRange(now = new Date(), weekOffset = 0) {
  const referenceDate = economicCalendarReferenceDate(now);
  const startDate = addCalendarDays(mondayForCalendarDate(referenceDate), weekOffset * 7);
  return { referenceDate, startDate, endDate: addCalendarDays(startDate, 6) };
}
