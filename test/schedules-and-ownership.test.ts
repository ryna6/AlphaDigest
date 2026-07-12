import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { nextTorontoRun } from "../lib/schedule/toronto";
import { selectLatestCompleteInstitutionPeriod } from "../lib/data/adapters/unusual-whales-institutional";

test("market and crypto daily candle crons are single UTC fallback schedules", () => {
  const market = fs.readFileSync("netlify/functions/refresh-daily-market-candles.ts", "utf8");
  const crypto = fs.readFileSync("netlify/functions/refresh-daily-crypto-candles.ts", "utf8");
  const status = fs.readFileSync("lib/status/jobs.ts", "utf8");
  assert.match(market, /schedule: "0 23 \* \* 1-5"/);
  assert.match(crypto, /schedule: "0 6 \* \* \*"/);
  assert.doesNotMatch(`${market}\n${status}`, /30 22,23|outside_1830_toronto_window|6:30 PM guard/);
  assert.doesNotMatch(`${crypto}\n${status}`, /45 22|6:45 PM/);
});

test("UTC cron status next run reflects standard and daylight Toronto time", () => {
  assert.equal(nextTorontoRun({ days: [1,2,3,4,5], utcHours: [23], minutes: [0] }, new Date("2026-01-12T22:58:00Z"))?.toISOString(), "2026-01-12T23:00:00.000Z");
  assert.equal(nextTorontoRun({ days: [1,2,3,4,5], utcHours: [23], minutes: [0] }, new Date("2026-07-13T22:58:00Z"))?.toISOString(), "2026-07-13T23:00:00.000Z");
  assert.equal(nextTorontoRun({ utcHours: [6], minutes: [0] }, new Date("2026-07-12T05:58:00Z"))?.toISOString(), "2026-07-12T06:00:00.000Z");
});

test("latest complete institution period falls back before Q2 2026 filing deadline", () => {
  const result = selectLatestCompleteInstitutionPeriod({ infoDates: ["2026-06-30", "2026-03-31"], holdingDates: ["2026-03-31"] });
  assert.equal(result.selectedReportDate, "2026-03-31");
  assert.deepEqual(result.incompleteNewerPeriods, ["2026-06-30"]);
});

test("latest complete institution period selects complete newer quarter", () => {
  const result = selectLatestCompleteInstitutionPeriod({ infoDates: ["2026-06-30", "2026-03-31"], holdingDates: ["2026-06-30", "2026-03-31"] });
  assert.equal(result.selectedReportDate, "2026-06-30");
});
