import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { classifyStatusJob, STATUS_JOBS, type StatusJob } from "../lib/status/jobs";
import { STATUS_DOT_CLASS } from "../lib/status/presentation";

const weekdayJob: StatusJob = {
  id: "test-weekday",
  group: "Markets",
  job: "Weekday source",
  functionName: "refresh-test",
  source: "Provider",
  frequency: "Every 5m, Mon–Fri",
  nextRunRule: { days: [1, 2, 3, 4, 5], intervalMinutes: 5, minuteOffset: 5 },
  staleAfterMinutes: 15
};
const success = (at: string) => ({
  function_name: "refresh-test" as const,
  status: "success" as const,
  started_at: at,
  finished_at: at,
  rows_fetched: 1,
  rows_inserted: 1,
  rows_updated: 0,
  error_message: null,
  warning_message: null
});

test("weekday jobs are healthy while fresh and idle outside their schedule", () => {
  const friday = success("2026-09-18T19:55:00Z");
  assert.equal(classifyStatusJob(weekdayJob, friday, friday, new Date("2026-09-18T20:00:00Z")), "Healthy");
  assert.equal(classifyStatusJob(weekdayJob, friday, friday, new Date("2026-09-19T16:00:00Z")), "Idle");
  assert.equal(classifyStatusJob(weekdayJob, friday, friday, new Date("2026-09-21T04:03:00Z")), "Idle");
  assert.equal(classifyStatusJob(weekdayJob, friday, friday, new Date("2026-09-21T04:30:00Z")), "Offline");
});

test("daily jobs do not become idle on weekends and errors take precedence", () => {
  const friday = success("2026-09-18T19:55:00Z");
  const daily = { ...weekdayJob, nextRunRule: { intervalMinutes: 5, minuteOffset: 0 } };
  assert.equal(classifyStatusJob(daily, friday, friday, new Date("2026-09-19T16:00:00Z")), "Offline");
  assert.equal(
    classifyStatusJob(
      weekdayJob,
      { ...friday, status: "error", error_message: "provider unavailable" },
      friday,
      new Date("2026-09-19T16:00:00Z")
    ),
    "Error"
  );
});

test("weekday provider jobs with no retained telemetry are idle late Sunday in Toronto", () => {
  const sundayBeforeMidnightToronto = new Date("2026-09-21T03:30:00Z");
  const expectedIdleIds = [
    "flow-insider-trades",
    "flow-dark-pool",
    "flow-whale-feed",
    "markets-indices-heatmaps",
    "markets-sp500-heatmap",
    "markets-daily-candles",
    "markets-movers"
  ];

  for (const id of expectedIdleIds) {
    const job = STATUS_JOBS.find((candidate) => candidate.id === id);
    assert.ok(job, `${id} must remain registered with its provider schedule`);
    assert.equal(classifyStatusJob(job, undefined, undefined, sundayBeforeMidnightToronto), "Idle", id);
  }
});

test("missing telemetry is offline when a job is expected to be active", () => {
  assert.equal(
    classifyStatusJob(weekdayJob, undefined, undefined, new Date("2026-09-22T16:00:00Z")),
    "Offline"
  );
});

test("warning and idle use distinct semantic colors", () => {
  assert.equal(STATUS_DOT_CLASS.Warning, "bg-[#d97706]");
  assert.equal(STATUS_DOT_CLASS.Idle, "bg-[#a3a83a]");
  assert.notEqual(STATUS_DOT_CLASS.Warning, STATUS_DOT_CLASS.Idle);
});

test("status breakdown exposes exactly the five product states in the requested order", () => {
  const source = fs.readFileSync("components/status/status-breakdown-button.tsx", "utf8");
  const labels = [...source.matchAll(/label: "(Good|Warning|Critical|Idle|Offline)"/g)].map(
    (match) => match[1]
  );
  assert.deepEqual(labels, ["Good", "Warning", "Critical", "Idle", "Offline"]);
  assert.doesNotMatch(source, /label: "Unknown"/);
});
