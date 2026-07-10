import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { candleRangeBounds } from "../lib/data/daily-candles";
import { prepareTradingViewData, toTradingViewTime } from "../components/dashboard/markets/tradingview-ohlcv-chart";

test("crypto 1W uses seven calendar days including weekends", () => {
  assert.deepEqual(candleRangeBounds("1W", "2026-07-09"), { from: "2026-07-03", to: "2026-07-09" });
});

test("calendar ranges use latest available candle", () => {
  assert.deepEqual(candleRangeBounds("1M", "2026-03-31"), { from: "2026-02-28", to: "2026-03-31" });
  assert.deepEqual(candleRangeBounds("3M", "2026-07-10"), { from: "2026-04-10", to: "2026-07-10" });
  assert.deepEqual(candleRangeBounds("YTD", "2026-07-10"), { from: "2026-01-01", to: "2026-07-10" });
  assert.deepEqual(candleRangeBounds("1Y", "2024-02-29"), { from: "2023-02-28", to: "2024-02-29" });
});

test("TradingView adapter preserves daily business days and normalizes data", () => {
  assert.deepEqual(toTradingViewTime("2026-07-10"), { year:2026, month:7, day:10 });
  assert.equal(toTradingViewTime("2026-07-10T12:00:00Z"), 1783684800);
  const data = prepareTradingViewData([
    { time:"2026-07-11", open:2, high:3, low:1, close:1.5, volume:null },
    { time:"2026-07-10", open:1, high:2, low:0.5, close:1.5, volume:0 },
    { time:"2026-07-10", open:9, high:9, low:9, close:9, volume:9 }
  ]);
  assert.equal(data.candles.length, 2);
  assert.equal(data.volumes.length, 1);
  assert.match(data.volumes[0].color, /22c55e/);
});

test("crypto function rename repository expectations", () => {
  assert.equal(fs.existsSync("netlify/functions/refresh-daily-crypto-candles.ts"), true);
  assert.equal(fs.existsSync("netlify/functions/refresh-crypto-daily-candles.ts"), false);
  assert.match(fs.readFileSync("lib/status/jobs.ts", "utf8"), /Daily Crypto Candles/);
  assert.doesNotMatch(fs.readFileSync("lib/status/jobs.ts", "utf8"), /Crypto Daily Candles/);
});
