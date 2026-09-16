import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnoseInvestingEconomicCalendarPayload,
  extractInvestingEconomicRows,
  inspectInvestingEconomicPayload
} from "../lib/data/adapters/investing-economic-calendar";

const event = { id: 101, name: "Initial Jobless Claims", importance: "high" };
const occurrence = {
  event_id: "101",
  datetime: "2026-07-30T08:30:00-04:00",
  actual: "220K",
  forecast: "225K",
  previous: "221K"
};

test("current nested events/occurrences wrapper links metadata to occurrences across string IDs", () => {
  const payload = { data: { events: [event], occurrences: [occurrence], pagination: { page: 1 } } };
  const result = diagnoseInvestingEconomicCalendarPayload(payload, "2026-07-30");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventName, "Initial Jobless Claims");
  assert.equal(result.events[0].actual, "220K");
  assert.equal(result.diagnostics.rawRows, 1);
  assert.equal(result.diagnostics.skipReasons.missingEventName, 0);
});

test("legacy rows wrapper remains supported and exclusions have bounded reasons", () => {
  const payload = {
    results: {
      rows: [
        {
          event_name: "ISM Services PMI",
          datetime: "2026-07-30T10:00:00-04:00",
          importance: "medium"
        },
        {
          event_name: "Crude Oil Inventories",
          datetime: "2026-07-30T10:30:00-04:00",
          importance: "high"
        },
        { datetime: "2026-07-30T11:00:00-04:00", importance: "high" }
      ]
    }
  };
  const result = diagnoseInvestingEconomicCalendarPayload(payload, "2026-07-30");
  assert.equal(result.events.length, 1);
  assert.equal(result.diagnostics.skipReasons.excludedByIncludedEventRules, 1);
  assert.equal(result.diagnostics.skipReasons.missingEventName, 1);
});

test("payload inspection reports bounded array paths without logging payload values", () => {
  const payload = { data: { events: [event], occurrences: [occurrence] } };
  assert.equal(extractInvestingEconomicRows(payload).length, 1);
  assert.deepEqual(
    inspectInvestingEconomicPayload(payload).arrays.map((item) => item.path),
    ["$.data.events", "$.data.occurrences"]
  );
});

test("current nested occurrence objects are flattened before normalization", () => {
  const payload = {
    data: { events: [event], occurrences: [{ event: { id: 101 }, occurrence: occurrence }] }
  };
  const result = diagnoseInvestingEconomicCalendarPayload(payload, "2026-07-30");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventName, "Initial Jobless Claims");
  assert.equal(result.events[0].timestamp, new Date(occurrence.datetime).toISOString());
});
