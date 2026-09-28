import assert from "node:assert/strict";
import test from "node:test";
import {
  economicCalendarReferenceDate,
  economicCalendarWeekRange
} from "../lib/calendar/reference";
import { initialDaySelection } from "../components/dashboard/news-calendar/news-calendar-view";

test("economic calendar uses the preceding Toronto Friday throughout the weekend", () => {
  assert.equal(economicCalendarReferenceDate(new Date("2026-09-18T16:00:00Z")), "2026-09-18");
  assert.equal(economicCalendarReferenceDate(new Date("2026-09-19T16:00:00Z")), "2026-09-18");
  assert.equal(economicCalendarReferenceDate(new Date("2026-09-21T03:00:00Z")), "2026-09-18");
  assert.equal(economicCalendarReferenceDate(new Date("2026-09-21T16:00:00Z")), "2026-09-21");
});

test("week ranges remain anchored to the Friday week and keep Monday in next week", () => {
  const sundayAtElevenToronto = new Date("2026-09-21T03:00:00Z");
  assert.deepEqual(economicCalendarWeekRange(sundayAtElevenToronto), {
    referenceDate: "2026-09-18",
    startDate: "2026-09-14",
    endDate: "2026-09-20"
  });
  assert.equal(economicCalendarWeekRange(sundayAtElevenToronto, 1).startDate, "2026-09-21");
  const selection = initialDaySelection(sundayAtElevenToronto);
  assert.equal(selection.selectedDate, "2026-09-18");
  assert.equal(selection.days[0].date, "2026-09-14");
});

test("Toronto calendar reference follows DST rather than a fixed UTC offset", () => {
  assert.equal(economicCalendarReferenceDate(new Date("2026-01-05T04:30:00Z")), "2026-01-02");
  assert.equal(economicCalendarReferenceDate(new Date("2026-07-06T03:30:00Z")), "2026-07-03");
});
