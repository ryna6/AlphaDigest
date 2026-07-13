import assert from "node:assert/strict";
import test from "node:test";
import { calculateMarketWatchFromCandles, isAtPriceLevel, weeklyClosesFromDailyCandles } from "../lib/data/market-watch-candles";
import type { DailyCandle } from "../lib/data/daily-candles";

const day = (i: number) => { const d = new Date(Date.UTC(2020, 0, 1 + i)); return d.toISOString().slice(0, 10); };
function row(symbol: string, i: number, close = 100, high = close + 1, low = close - 1): DailyCandle { return { symbol, providerSymbol: symbol, tradingDate: day(i), open: close, high, low, close, volume: null, previousClose: null, source: "test", sourceTimestamp: null, fetchedAt: "now" }; }
function rows(symbol: string, count: number, close = 100) { return Array.from({ length: count }, (_, i) => row(symbol, i, close)); }

test("52W highs require latest high to equal or exceed prior 252 highs and exclude latest", () => {
  assert.equal(calculateMarketWatchFromCandles([...rows("EQ", 252, 100), row("EQ", 252, 100, 101, 99)], ["EQ"]).marketWatch.highs52Week.items[0].signal, "new_high");
  assert.equal(calculateMarketWatchFromCandles([...rows("EX", 252, 100), row("EX", 252, 100, 102, 99)], ["EX"]).marketWatch.highs52Week.items[0].signal, "new_high");
  assert.equal(calculateMarketWatchFromCandles([...rows("BE", 252, 100), row("BE", 252, 100, 100.5, 99)], ["BE"]).marketWatch.highs52Week.items.length, 0);
  assert.equal(calculateMarketWatchFromCandles([...rows("INS", 251, 100), row("INS", 251, 100, 200, 99)], ["INS"]).marketWatch.highs52Week.items.length, 0);
  assert.equal(calculateMarketWatchFromCandles([...rows("BAD", 252, 100), row("BAD", 252, 100, Number.NaN, 99)], ["BAD"]).coverage.eligibleSymbols, 0);
});

test("52W lows require latest low to equal or fall below prior 252 lows and exclude latest", () => {
  assert.equal(calculateMarketWatchFromCandles([...rows("EQ", 252, 100), row("EQ", 252, 100, 101, 99)], ["EQ"]).marketWatch.lows52Week.items[0].signal, "new_low");
  assert.equal(calculateMarketWatchFromCandles([...rows("EX", 252, 100), row("EX", 252, 100, 101, 98)], ["EX"]).marketWatch.lows52Week.items[0].signal, "new_low");
  assert.equal(calculateMarketWatchFromCandles([...rows("AB", 252, 100), row("AB", 252, 100, 101, 99.5)], ["AB"]).marketWatch.lows52Week.items.length, 0);
  assert.equal(calculateMarketWatchFromCandles([...rows("INS", 251, 100), row("INS", 251, 100, 101, 1)], ["INS"]).marketWatch.lows52Week.items.length, 0);
  assert.equal(calculateMarketWatchFromCandles([...rows("BAD", 252, 100), row("BAD", 252, 100, 101, -1)], ["BAD"]).coverage.eligibleSymbols, 0);
});

test("200D MA signals require crosses or exact at, with stale exclusion", () => {
  const above = [...rows("ABV", 199, 100), row("ABV", 199, 99), row("ABV", 200, 101)];
  const below = [...rows("BLW", 199, 100), row("BLW", 199, 101), row("BLW", 200, 99)];
  assert.equal(calculateMarketWatchFromCandles(above, ["ABV"]).marketWatch.crosses200Day.items[0].signal, "crossed_above");
  assert.equal(calculateMarketWatchFromCandles(below, ["BLW"]).marketWatch.crosses200Day.items[0].signal, "crossed_below");
  assert.equal(calculateMarketWatchFromCandles([...rows("RA", 199, 100), row("RA", 199, 101), row("RA", 200, 102)], ["RA"]).marketWatch.crosses200Day.items.length, 0);
  assert.equal(calculateMarketWatchFromCandles([...rows("RB", 199, 100), row("RB", 199, 99), row("RB", 200, 98)], ["RB"]).marketWatch.crosses200Day.items.length, 0);
  assert.equal(calculateMarketWatchFromCandles(rows("AT", 201, 100), ["AT"]).marketWatch.crosses200Day.items[0].signal, "at");
  assert.equal(calculateMarketWatchFromCandles(rows("FEW", 200, 100), ["FEW"]).marketWatch.crosses200Day.eligibleSymbols, 0);
  assert.equal(isAtPriceLevel(100.004, 100.001), true);
  assert.equal(calculateMarketWatchFromCandles([...rows("CUR", 201), ...rows("OLD", 200)], ["CUR", "OLD"]).coverage.staleSymbols.includes("OLD"), true);
});

test("200W MA uses final weekly close and reports insufficient history", () => {
  const week = [row("WK", 0, 1), row("WK", 1, 2), row("WK", 2, 3)];
  assert.equal(weeklyClosesFromDailyCandles(week)[0].close, 3);
  const holiday = [row("HOL", 0, 1), row("HOL", 3, 4)];
  assert.equal(weeklyClosesFromDailyCandles(holiday).at(-1)?.close, 4);
  const enough = Array.from({ length: 201 }, (_, i) => row("W", i * 7, i < 199 ? 100 : i === 199 ? 99 : 101));
  assert.equal(calculateMarketWatchFromCandles(enough, ["W"]).marketWatch.crosses200Week.available, true);
  assert.equal(calculateMarketWatchFromCandles(enough, ["W"]).marketWatch.crosses200Week.items[0].signal, "crossed_above");
  const down = Array.from({ length: 201 }, (_, i) => row("WD", i * 7, i < 199 ? 100 : i === 199 ? 101 : 99));
  assert.equal(calculateMarketWatchFromCandles(down, ["WD"]).marketWatch.crosses200Week.items[0].signal, "crossed_below");
  const at = Array.from({ length: 201 }, (_, i) => row("WA", i * 7, 100));
  assert.equal(calculateMarketWatchFromCandles(at, ["WA"]).marketWatch.crosses200Week.items[0].signal, "at");
  const few = Array.from({ length: 200 }, (_, i) => row("WF", i * 7, 100));
  assert.equal(calculateMarketWatchFromCandles(few, ["WF"]).marketWatch.crosses200Week.available, false);
  assert.equal(calculateMarketWatchFromCandles(few, ["WF"]).marketWatch.crosses200Week.reason, "Insufficient history");
});

test("Market Watch limits rows and sorts deterministically", () => {
  const all = ["CCC", "AAA", "BBB", "DDD", "EEE", "FFF"].flatMap((s, idx) => [...rows(s, 252, 100), row(s, 252, 100, 102 + idx, 99)]);
  const items = calculateMarketWatchFromCandles(all, ["CCC", "AAA", "BBB", "DDD", "EEE", "FFF"]).marketWatch.highs52Week.items;
  assert.equal(items.length, 5);
  assert.deepEqual(items.map((i) => i.symbol), ["FFF", "EEE", "DDD", "BBB", "AAA"]);
});
