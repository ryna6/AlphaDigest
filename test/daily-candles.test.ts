import test from "node:test";
import assert from "node:assert/strict";
import { calculateMarketBreadthFromCandles } from "../lib/data/market-breadth-candles";
import { normalizeFinnhubQuote, normalizeUnusualWhalesCandles, oneYearCutoff, validateOhlc, type DailyCandle } from "../lib/data/daily-candles";
import { cryptoCandleAssets, normalizeAppSymbol, toFinnhubShareClassSymbol } from "../lib/data/market-assets";

test("normalizes valid Finnhub quote and rejects invalid OHLC", () => {
  const c = normalizeFinnhubQuote("BRK-B", "BRK.B", { o: 10, h: 12, l: 9, c: 11, pc: 10, t: 1762819200 });
  assert.equal(c.symbol, "BRK-B"); assert.equal(c.providerSymbol, "BRK.B"); assert.equal(c.tradingDate, "2025-11-10");
  assert.throws(() => normalizeFinnhubQuote("AAPL", "AAPL", { o: 0, h: 1, l: 1, c: 1, t: 1 }), /missing positive/);
  assert.throws(() => validateOhlc(10, 9, 8, 11), /Invalid OHLC/);
});

test("normalizes observed Unusual Whales wrapper variants and crypto mappings", () => {
  const rows = normalizeUnusualWhalesCandles("BTCUSD", "BTC-USD", { data: [{ date: "2026-07-09", open: "100", high: "110", low: "90", close: "105" }] }, "Unusual Whales Crypto");
  assert.equal(rows.length, 1); assert.equal(rows[0].tradingDate, "2026-07-09");
  assert.deepEqual(cryptoCandleAssets.map(a => a.unusualWhalesSymbol), ["BTC-USD","ETH-USD","SOL-USD","XRP-USD","BNB-USD","TRX-USD","ADA-USD","DOGE-USD"]);
  assert.equal(normalizeAppSymbol("brk.b"), "BRK-B"); assert.equal(toFinnhubShareClassSymbol("BRK-B"), "BRK.B");
});

test("one-year cutoff handles leap years", () => {
  assert.equal(oneYearCutoff(new Date("2025-02-28T12:00:00Z"), "UTC"), "2024-02-28");
  assert.equal(oneYearCutoff(new Date("2024-02-29T12:00:00Z"), "UTC"), "2023-03-01");
});

function candle(symbol:string, day:number, close:number): DailyCandle { return { symbol, providerSymbol:symbol, tradingDate:`2026-01-${String(day).padStart(2,"0")}`, open:close, high:close+1, low:close-1, close, previousClose:null, source:"test", sourceTimestamp:null, fetchedAt:"now" }; }
test("breadth calculates participation, SMA, 52-week and coverage", () => {
  const rows: DailyCandle[] = [];
  for (const s of ["AAA","BBB"]) for (let i=1;i<=200;i++) rows.push(candle(s, (i%28)+1, s==="AAA" ? i : 300-i));
  const result = calculateMarketBreadthFromCandles(rows, ["AAA","BBB","CCC"], 1);
  assert.equal(result.metrics.find(m=>m.label==="Advancers / Decliners")?.value, "1 / 1");
  assert.equal(result.coverage.sma50.eligible, 2); assert.equal(result.coverage.sma200.eligible, 2); assert.equal(result.coverage.week52.eligible, 2); assert.ok(result.warning);
  assert.equal(calculateMarketBreadthFromCandles(rows, ["AAA"], 0).metrics[0].value, "—");
});
