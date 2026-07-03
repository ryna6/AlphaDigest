import assert from "node:assert/strict";
import test from "node:test";
import {
  createMarketBreadthSnapshot,
  marketBreadthMetrics,
  parseLatestInvestingBreadthRow,
  parseYahooScreenerTotal,
  readCachedSp500Breadth,
  validateMarketBreadth,
  writeInvestingBreadthSnapshot,
  writeMarketBreadthSnapshot,
  writeYahooBreadthSnapshot,
  yahooScreenerRequest,
  YAHOO_52_WEEK_SOURCES
} from "../lib/data/adapters/market-breadth";

const ohlc = { timestamp: 1782950400000, open: 66.46, high: 67.26, low: 64.88, close: 67.06 };
const parsed = {
  above50d: ohlc,
  above200d: { timestamp: 1782950400000, open: 50, high: 60, low: 45, close: 55 },
  highs52w: 3,
  lows52w: 1,
  sourceUpdatedAt: null,
  movingAverageSource: "Investing.com",
  highLowSource: "Yahoo"
};

test("Investing parser requires payload.data and rejects empty data", () => {
  assert.throws(
    () => parseLatestInvestingBreadthRow([[1762819200000, 56.46, 58.05, 56.46, 57.45, 0, 0]]),
    /payload\.data/
  );
  assert.throws(() => parseLatestInvestingBreadthRow({ data: [] }), /no valid/i);
});

test("Investing parser reads exact supplied payload.data fixture indexes", () => {
  assert.deepEqual(
    parseLatestInvestingBreadthRow({
      data: [
        [1782864000000, 64.34, 66.13, 63.09, 63.09, 0, 0],
        [1782950400000, 66.46, 67.26, 64.88, 67.06, 0, 0]
      ],
      events: null
    }),
    { timestamp: 1782950400000, open: 66.46, high: 67.26, low: 64.88, close: 67.06 }
  );
});

test("Investing parser selects latest row by maximum timestamp from unordered rows", () => {
  assert.deepEqual(
    parseLatestInvestingBreadthRow({
      data: [
        [1782864000000, 90, 95, 89, 94, 0],
        [1782950400000, 66.46, 67.26, 64.88, 67.06, 0]
      ]
    }),
    ohlc
  );
});

test("Investing parser does not confuse timestamp selection with highest price", () => {
  assert.equal(
    parseLatestInvestingBreadthRow({
      data: [
        [1000, 99, 100, 98, 99],
        [2000, 10, 12, 9, 11]
      ]
    }).timestamp,
    2000
  );
});

test("Investing parser returns OHLC values, ignores malformed rows, and allows extra indexes", () => {
  assert.deepEqual(
    parseLatestInvestingBreadthRow({
      data: [
        [3000, "bad", 2],
        [1782950400000, 66.46, 67.26, 64.88, 67.06, 0, 0, 123]
      ]
    }),
    ohlc
  );
});

test("Investing parser rejects strings instead of numbers", () => {
  assert.throws(
    () =>
      parseLatestInvestingBreadthRow({
        data: [[1782950400000, "66.46", "67.26", "64.88", "67.06"]]
      }),
    /no valid/i
  );
});

test("Investing parser fails when no valid rows exist", () => {
  assert.throws(
    () =>
      parseLatestInvestingBreadthRow({
        data: [
          [1, "x", 2, 3, 4],
          [2, 1, "y", 3, 4]
        ]
      }),
    /no valid/i
  );
});

test("Investing parser validates positive timestamps and percentage ranges without OHLC over-rejection", () => {
  assert.deepEqual(parseLatestInvestingBreadthRow({ data: [[1, 50, 49, 45, 51]] }), {
    timestamp: 1,
    open: 50,
    high: 49,
    low: 45,
    close: 51
  });
  assert.throws(
    () => validateMarketBreadth({ ...parsed, above50d: { ...ohlc, close: 101 } }),
    /outside 0-100/
  );
  assert.throws(
    () => validateMarketBreadth({ ...parsed, above50d: { ...ohlc, timestamp: 0 } }),
    /timestamp/
  );
});

test("Market breadth UI metrics use latest close as the moving-average percentage", () => {
  const metrics = marketBreadthMetrics(createMarketBreadthSnapshot(parsed));
  assert.equal(metrics[0].value, "67.1%");
  assert.equal(metrics[1].value, "55.0%");
  assert.equal(metrics[2].value, "3 / 1");
});

test("Yahoo total parser uses total instead of count or records length", () => {
  assert.equal(
    parseYahooScreenerTotal({
      finance: { result: [{ start: 0, count: 25, total: 57, records: [] }], error: null }
    }),
    57
  );
});

test("Yahoo total parser reads finance.result[0].total", () => {
  assert.equal(
    parseYahooScreenerTotal({
      finance: {
        result: [{ start: 0, count: 100, total: 57, records: [] }],
        error: null
      }
    }),
    57
  );
});

test("Yahoo total parser rejects empty, missing, negative, non-numeric, and error responses", () => {
  assert.throws(() => parseYahooScreenerTotal({ finance: { result: [], error: null } }), /empty/);
  assert.throws(
    () => parseYahooScreenerTotal({ finance: { result: [{}], error: null } }),
    /missing total/
  );
  assert.throws(
    () => parseYahooScreenerTotal({ finance: { result: [{ total: -1 }], error: null } }),
    /non-negative/
  );
  assert.throws(
    () => parseYahooScreenerTotal({ finance: { result: [{ total: "x" }], error: null } }),
    /non-negative/
  );
  assert.throws(
    () => parseYahooScreenerTotal({ finance: { error: { code: "Unauthorized" }, result: [] } }),
    /error/
  );
});

test("Yahoo high and low requests use distinct screener identifiers in POST bodies", () => {
  const highs = yahooScreenerRequest(YAHOO_52_WEEK_SOURCES.highs.scrId);
  const lows = yahooScreenerRequest(YAHOO_52_WEEK_SOURCES.lows.scrId);
  assert.notEqual(highs.body.scrIds, lows.body.scrIds);
  assert.equal(highs.body.scrIds, "recent_52_week_highs");
  assert.equal(lows.body.scrIds, "recent_52_week_lows");
});

test("Yahoo screener request can add refreshed crumb without hardcoding one", () => {
  assert.equal(yahooScreenerRequest("recent_52_week_highs").url.includes("crumb="), false);
  assert.equal(
    yahooScreenerRequest("recent_52_week_highs", "fresh").url.includes("crumb=fresh"),
    true
  );
});

test("one incomplete source prevents database write", async () => {
  let called = false;
  const client = {
    from: () => ({
      upsert: () => {
        called = true;
        return {
          select: () => ({
            single: async () => ({ data: { id: "sp500", fetched_at: "now" }, error: null })
          })
        };
      }
    })
  } as never;
  assert.throws(
    () =>
      createMarketBreadthSnapshot({
        ...parsed,
        above200d: { ...parsed.above200d, close: Number.NaN }
      }),
    /not finite|outside/
  );
  assert.equal(called, false);
});

test("provider snapshots target split tables and store correct fields", async () => {
  const snapshot = createMarketBreadthSnapshot(parsed, "2026-07-03T00:00:00.000Z");
  const calls: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from: (name: string) => ({
      upsert: (payload: Record<string, unknown>) => {
        calls.push({ table: name, row: payload });
        return {
          select: () => ({
            single: async () => ({
              data: { id: "sp500", fetched_at: "2026-07-03T00:00:00.000Z" },
              error: null
            })
          })
        };
      }
    })
  } as never;
  await writeMarketBreadthSnapshot(client, snapshot);
  assert.deepEqual(
    calls.map((call) => call.table),
    ["%_above_ma", "52w_high_low"]
  );
  assert.equal(calls[0].row.above_50d_close, 67.06);
  assert.equal(calls[0].row.above_200d_open, 50);
  assert.equal(calls[1].row.highs_52w, 3);
  assert.equal(calls[1].row.lows_52w, 1);
  assert.equal(
    calls.some((call) => call.table === "market_breadth"),
    false
  );
});

test("Supabase write errors are thrown and no success is inferred from empty data", async () => {
  const snapshot = createMarketBreadthSnapshot(parsed, "2026-07-03T00:00:00.000Z");
  const failingClient = {
    from: () => ({
      upsert: () => ({
        select: () => ({ single: async () => ({ data: null, error: { message: "bad conflict" } }) })
      })
    })
  } as never;
  await assert.rejects(() => writeMarketBreadthSnapshot(failingClient, snapshot), /bad conflict/);
  const emptyClient = {
    from: () => ({
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) })
    })
  } as never;
  await assert.rejects(() => writeMarketBreadthSnapshot(emptyClient, snapshot), /returned no row/);
});

test("malformed Investing snapshot prevents only Investing write", async () => {
  let called = false;
  const client = {
    from: () => ({
      upsert: () => {
        called = true;
        return { select: () => ({ single: async () => ({ data: {}, error: null }) }) };
      }
    })
  } as never;
  await assert.rejects(
    () =>
      writeInvestingBreadthSnapshot(client, {
        id: "sp500",
        above50d: { ...ohlc, close: Number.NaN },
        above200d: parsed.above200d,
        sourceUrl: "u",
        fetchedAt: "now",
        contentHash: "h"
      }),
    /not finite/
  );
  assert.equal(called, false);
});

test("Yahoo and Investing writes are independently callable for partial success", async () => {
  const calls: string[] = [];
  const client = {
    from: (name: string) => ({
      upsert: () => ({
        select: () => ({
          single: async () => {
            calls.push(name);
            return { data: { id: "sp500" }, error: null };
          }
        })
      })
    })
  } as never;
  await writeInvestingBreadthSnapshot(client, {
    id: "sp500",
    above50d: parsed.above50d,
    above200d: parsed.above200d,
    sourceUrl: "u",
    fetchedAt: "now",
    contentHash: "h"
  });
  await writeYahooBreadthSnapshot(client, {
    id: "sp500",
    highs52w: 3,
    lows52w: 1,
    sourceUrl: "u",
    fetchedAt: "now",
    contentHash: "h"
  });
  assert.deepEqual(calls, ["%_above_ma", "52w_high_low"]);
});

test("latest-row reader queries split tables ordered by fetched_at", async () => {
  const tables: string[] = [];
  const orders: string[] = [];
  const client = {
    from: (name: string) => {
      tables.push(name);
      return {
        select: () => ({
          order: (column: string) => {
            orders.push(`${name}:${column}`);
            return {
              limit: () => ({
                maybeSingle: async () => ({
                  data:
                    name === "%_above_ma"
                      ? {
                          above_50d_timestamp: 1782950400000,
                          above_50d_open: 66.46,
                          above_50d_high: 67.26,
                          above_50d_low: 64.88,
                          above_50d_close: 67.06,
                          above_200d_timestamp: 1782950400000,
                          above_200d_open: 50,
                          above_200d_high: 60,
                          above_200d_low: 45,
                          above_200d_close: 55,
                          fetched_at: "now"
                        }
                      : { highs_52w: 3, lows_52w: 1, fetched_at: "now" },
                  error: null
                })
              })
            };
          }
        })
      };
    }
  } as never;
  const result = await readCachedSp500Breadth(client);
  assert.equal(result.snapshot?.above50d.close, 67.06);
  assert.equal(result.snapshot?.highs52w, 3);
  assert.deepEqual(tables, ["%_above_ma", "52w_high_low"]);
  assert.deepEqual(orders, ["%_above_ma:fetched_at", "52w_high_low:fetched_at"]);
});
