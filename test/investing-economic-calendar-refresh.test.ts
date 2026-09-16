import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildInvestingEconomicCalendarRequestHeaders,
  defaultEconomicRefreshDateKeys,
  diagnoseInvestingEconomicCalendarPayload,
  economicEventRetentionCutoff,
  economicRefreshDateKeysForPeriod,
  extractInvestingEconomicRows,
  fetchInvestingEconomicCalendar,
  inspectInvestingEconomicPayload
} from "../lib/data/adapters/investing-economic-calendar";
import { featuredArticleRetentionCutoff } from "../lib/data/adapters/unusual-whales-news";

const event = { id: 101, name: "Initial Jobless Claims", importance: "high" };
const occurrence = {
  event_id: "101",
  datetime: "2026-07-30T08:30:00-04:00",
  actual: "220K",
  forecast: "225K",
  previous: "221K"
};

test("calendar requests identify the public Investing web tenant", () => {
  const headers = buildInvestingEconomicCalendarRequestHeaders();
  assert.equal(headers["Domain-Id"], "www");
  assert.equal(headers.Origin, "https://www.investing.com");
  assert.equal(headers.Referer, "https://www.investing.com/economic-calendar/");
  assert.match(headers["User-Agent"], /Mozilla\/5\.0.*Chrome\//);
});

test("scheduled calendar periods issue one provider week instead of a three-week burst", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  assert.deepEqual(defaultEconomicRefreshDateKeys(now), ["2026-09-14"]);
  assert.deepEqual(economicRefreshDateKeysForPeriod("previous", now), ["2026-09-07"]);
  assert.deepEqual(economicRefreshDateKeysForPeriod("current", now), ["2026-09-14"]);
  assert.deepEqual(economicRefreshDateKeysForPeriod("next", now), ["2026-09-21"]);
});

test("retention cutoffs use authoritative timestamps and exact UTC boundaries", () => {
  const now = new Date("2026-09-16T12:34:56.000Z");
  assert.equal(economicEventRetentionCutoff(now), "2026-09-02T12:34:56.000Z");
  assert.equal(featuredArticleRetentionCutoff(now), "2026-09-09T12:34:56.000Z");
  assert.ok(new Date("2026-10-01T00:00:00Z") > new Date(economicEventRetentionCutoff(now)));
});

test("provider errors and empty payloads remain failures while last-known-good memory survives", async () => {
  const originalFetch = globalThis.fetch;
  const payload = {
    data: {
      events: [{ id: 101, name: "Initial Jobless Claims", importance: "high" }],
      occurrences: [{ event_id: "101", datetime: "2026-09-17T08:30:00-04:00", actual: "220K" }]
    }
  };
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    const live = await fetchInvestingEconomicCalendar("2026-09-16");
    assert.equal(live.mode, "live");
    assert.equal(live.events.length, 1);

    globalThis.fetch = async () =>
      new Response("Access denied by provider", {
        status: 403,
        headers: { "content-type": "text/html" }
      });
    const failed = await fetchInvestingEconomicCalendar("2026-09-16");
    assert.equal(failed.mode, "unavailable");
    assert.equal(failed.events.length, 1);
    assert.match(failed.message ?? "", /403.*text\/html.*Access denied/);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: { events: [], occurrences: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    const empty = await fetchInvestingEconomicCalendar("2026-09-23");
    assert.equal(empty.mode, "unavailable");
    assert.match(empty.message ?? "", /empty events collection/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an authorization rejection establishes and replays one browser session", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; cookie: string | null }> = [];
  const payload = {
    data: {
      events: [{ id: 101, name: "Initial Jobless Claims", importance: "high" }],
      occurrences: [{ event_id: "101", datetime: "2026-10-08T08:30:00-04:00" }]
    }
  };
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      requests.push({ url, cookie: headers.get("cookie") });
      if (url === "https://www.investing.com/economic-calendar/")
        return new Response("calendar", {
          status: 200,
          headers: { "set-cookie": "geoC=US; Path=/; Secure; SameSite=None" }
        });
      if (!headers.has("cookie"))
        return new Response("session required", {
          status: 403,
          headers: { "content-type": "text/html" }
        });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };
    const result = await fetchInvestingEconomicCalendar("2026-10-08");
    assert.equal(result.mode, "live");
    assert.equal(result.events.length, 1);
    assert.equal(result.diagnostics?.sessionRetry, true);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].cookie, null);
    assert.equal(requests[1].url, "https://www.investing.com/economic-calendar/");
    assert.equal(requests[2].cookie, "geoC=US");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retention migration uses provider timestamps and strict older-than predicates", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/0044_calendar_and_featured_retention.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /event_time < now\(\) - interval '14 days'/);
  assert.match(sql, /published_at < now\(\) - interval '7 days'/);
  assert.doesNotMatch(sql, /created_at\s*</);
});

test("automatic retention is service-role-only and independent of ingestion", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/0045_automatic_calendar_featured_retention.sql",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(sql, /event_time < now\(\) - interval '14 days'/);
  assert.match(sql, /published_at < now\(\) - interval '7 days'/);
  assert.match(sql, /grant execute[^;]+service_role/i);
  assert.doesNotMatch(sql, /event_time\s*>/);
});

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
