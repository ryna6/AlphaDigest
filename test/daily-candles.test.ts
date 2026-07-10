import test from "node:test";
import assert from "node:assert/strict";
import { calculateMarketBreadthFromCandles } from "../lib/data/market-breadth-candles";
import { dailyCandleRowsForUpsert, normalizeFinnhubQuote, normalizeUnusualWhalesCandles, normalizeUnusualWhalesCandlesWithDiagnostics, oneYearCutoff, validateOhlc, type DailyCandle } from "../lib/data/daily-candles";
import { cryptoCandleAssets, normalizeAppSymbol, toFinnhubShareClassSymbol } from "../lib/data/market-assets";
import { buildUnusualWhalesCryptoCandleUrl } from "../lib/data/unusual-whales-crypto-candles";

const mappings = [
  ["BTCUSD","BTC-USD"],["ETHUSD","ETH-USD"],["SOLUSD","SOL-USD"],["XRPUSD","XRP-USD"],["BNBUSD","BNB-USD"],["TRXUSD","TRX-USD"],["ADAUSD","ADA-USD"],["DOGEUSD","DOGE-USD"]
] as const;

test("normalizes valid Finnhub quote and rejects invalid OHLC", () => {
  const c = normalizeFinnhubQuote("BRK-B", "BRK.B", { o: 10, h: 12, l: 9, c: 11, pc: 10, t: 1762819200 });
  assert.equal(c.symbol, "BRK-B"); assert.equal(c.providerSymbol, "BRK.B"); assert.equal(c.tradingDate, "2025-11-10"); assert.equal(c.volume, null);
  assert.throws(() => normalizeFinnhubQuote("AAPL", "AAPL", { o: 0, h: 1, l: 1, c: 1, t: 1 }), /missing positive/);
  assert.throws(() => validateOhlc(10, 9, 8, 11), /Invalid OHLC/);
});

test("configures exact uppercase crypto endpoint mappings", () => {
  assert.deepEqual(cryptoCandleAssets.map(a => [a.symbol, a.unusualWhalesSymbol]), mappings);
  assert.equal(new Set(cryptoCandleAssets.map(a => a.symbol)).size, 8);
  for (const [, provider] of mappings) {
    assert.equal(provider, provider.toUpperCase());
    const url = buildUnusualWhalesCryptoCandleUrl(provider, "2025-07-10");
    assert.equal(url, `https://phx.unusualwhales.com/api/crypto_candles/${provider}/1d/2025-07-10`);
    assert.ok(!url.endsWith("."));
  }
  assert.equal(normalizeAppSymbol("brk.b"), "BRK-B"); assert.equal(toFinnhubShareClassSymbol("BRK-B"), "BRK.B");
});

test("normalizes observed Unusual Whales crypto short fields with diagnostics", () => {
  const payload = { payload: { data: [{ date: "2026-07-09", c: 108500.25, h: 110000, l: 106750, o: 107100, v: 12345.67 }] } };
  const d = normalizeUnusualWhalesCandlesWithDiagnostics("BTCUSD", "BTC-USD", payload, "Unusual Whales Crypto");
  assert.equal(d.arrayPath, "payload.data"); assert.equal(d.rawCount, 1); assert.equal(d.parsedCount, 1); assert.equal(d.skippedCount, 0);
  assert.equal(d.candles[0].close, 108500.25); assert.equal(d.candles[0].high, 110000); assert.equal(d.candles[0].low, 106750); assert.equal(d.candles[0].open, 107100); assert.equal(d.candles[0].volume, 12345.67);
});

test("parser accepts numeric strings and zero volume, rejects malformed rows", () => {
  const payload = { payload: { data: [
    { date: "2026-07-09T00:00:00Z", c: "105", h: "110", l: "90", o: "100", v: "0" },
    { date: 1783555200, c: 105, h: 110, l: 90, o: 100, v: -1 },
    { date: "bad", c: 105, h: 110, l: 90, o: 100, v: 1 },
    { c: 105, h: 110, l: 90, o: 100, v: 1 },
    { date: "2026-07-09", c: 120, h: 110, l: 90, o: 100, v: 1 }
  ] } };
  const d = normalizeUnusualWhalesCandlesWithDiagnostics("BTCUSD", "BTC-USD", payload, "Unusual Whales Crypto");
  assert.equal(d.parsedCount, 1); assert.equal(d.candles[0].volume, 0); assert.equal(d.skippedReasons.invalid_volume, 1); assert.equal(d.skippedReasons.missing_or_malformed_date, 2); assert.equal(d.skippedReasons.invalid_ohlc_relationship, 1);
});

test("long-form Unusual Whales fields remain supported", () => {
  const rows = normalizeUnusualWhalesCandles("BTCUSD", "BTC-USD", { data: [{ date: "2026-07-09", open: "100", high: "110", low: "90", close: "105", volume:"10" }] }, "Unusual Whales Crypto");
  assert.equal(rows.length, 1); assert.equal(rows[0].tradingDate, "2026-07-09"); assert.equal(rows[0].volume, 10);
});

test("upsert row mapping includes volume and omits unsupported asset_group", () => {
  const c: DailyCandle = { symbol:"BTCUSD", providerSymbol:"BTC-USD", tradingDate:"2026-07-09", open:1, high:2, low:1, close:2, volume:3.5, previousClose:null, source:"test", sourceTimestamp:null, fetchedAt:"now", assetGroup:"crypto" };
  const cryptoRow = dailyCandleRowsForUpsert("crypto_daily_candles", [c])[0] as any;
  assert.equal(cryptoRow.volume, 3.5); assert.equal("asset_group" in cryptoRow, false);
  const marketRow = dailyCandleRowsForUpsert("market_daily_candles", [{...c, volume:null}])[0] as any;
  assert.equal(marketRow.volume, null); assert.equal(marketRow.asset_group, "crypto");
});

test("one-year cutoff handles leap years", () => {
  assert.equal(oneYearCutoff(new Date("2025-02-28T12:00:00Z"), "UTC"), "2024-02-28");
  assert.equal(oneYearCutoff(new Date("2024-02-29T12:00:00Z"), "UTC"), "2023-03-01");
});

function candle(symbol:string, day:number, close:number): DailyCandle { return { symbol, providerSymbol:symbol, tradingDate:`2026-01-${String(day).padStart(2,"0")}`, open:close, high:close+1, low:close-1, close, volume:null, previousClose:null, source:"test", sourceTimestamp:null, fetchedAt:"now" }; }
test("breadth calculates participation, SMA, 52-week and coverage", () => {
  const rows: DailyCandle[] = [];
  for (const s of ["AAA","BBB"]) for (let i=1;i<=200;i++) rows.push(candle(s, (i%28)+1, s==="AAA" ? i : 300-i));
  const result = calculateMarketBreadthFromCandles(rows, ["AAA","BBB","CCC"], 1);
  assert.equal(result.metrics.find(m=>m.label==="Advancers / Decliners")?.value, "1 / 1");
  assert.equal(result.coverage.sma50.eligible, 2); assert.equal(result.coverage.sma200.eligible, 2); assert.equal(result.coverage.week52.eligible, 2); assert.ok(result.warning);
  assert.equal(calculateMarketBreadthFromCandles(rows, ["AAA"], 0).metrics[0].value, "—");
});

import { buildUnusualWhalesEquityCandleUrl, equityProviderTicker } from "../lib/data/unusual-whales-equity-candles";
import { findConfiguredCandleAsset } from "../lib/data/market-assets";
import { mergeVolumePreservingRows } from "../lib/data/daily-candles";

test("candle routing resolves crypto and fixed assets before S&P universe", () => {
  assert.equal(findConfiguredCandleAsset("BTCUSD", [])?.table, "crypto_daily_candles");
  assert.equal(findConfiguredCandleAsset("SPY", [])?.table, "market_daily_candles");
  assert.equal(findConfiguredCandleAsset("AAPL", ["AAPL"])?.table, "sp500_daily_candles");
  assert.equal(findConfiguredCandleAsset("NOTREAL", ["AAPL"]), null);
});

test("equity endpoint construction uses direct ticker_candles path without crypto suffix", () => {
  for (const symbol of ["AAPL", "SPY", "XLK"]){
    const url = buildUnusualWhalesEquityCandleUrl(symbol);
    assert.ok(url.includes(`/ticker_candles/${symbol}/historic/v2`));
    assert.ok(url.includes("interval=1y"));
    assert.ok(url.includes("include_1m_data=true"));
    assert.ok(!url.includes("-USD"));
  }
  assert.equal(equityProviderTicker("BRK-B"), "BRK.B");
  assert.ok(buildUnusualWhalesEquityCandleUrl("BRK.B").includes("BRK.B"));
});

test("equity parser accepts date c h l o v and reports zero-valid diagnostics", () => {
  const d = normalizeUnusualWhalesCandlesWithDiagnostics("AAPL", "AAPL", { data: [{ date: "2026-07-09", c: 213.75, h: 215.1, l: 210.4, o: 211.25, v: 48500123 }] }, "Unusual Whales Equity");
  assert.equal(d.arrayPath, "data"); assert.equal(d.parsedCount, 1); assert.equal(d.candles[0].tradingDate, "2026-07-09"); assert.equal(d.candles[0].close, 213.75); assert.equal(d.candles[0].volume, 48500123);
  const invalid = normalizeUnusualWhalesCandlesWithDiagnostics("AAPL", "AAPL", { payload: { data: [{ date: "2026-07-09", c: 1, h: 1, l: 1, o: 1, v: -1 }] } }, "Unusual Whales Equity");
  assert.equal(invalid.rawCount, 1); assert.equal(invalid.parsedCount, 0); assert.equal(invalid.skippedReasons.invalid_volume, 1);
});

test("volume merge preserves existing stored volume when incoming refresh has null", async () => {
  const rows = [{ symbol:"SPY", trading_date:"2026-07-09", volume:null, close:1 }];
  const query:any = { select(){ return query; }, calls:0, in(){ query.calls++; return query.calls === 2 ? Promise.resolve({ data:[{ symbol:"SPY", trading_date:"2026-07-09", volume:12345 }], error:null }) : query; } };
  const client:any = { from(){ return query; } };
  const merged = await mergeVolumePreservingRows("market_daily_candles", rows, client);
  assert.equal(merged[0].volume, 12345);
});

import { getDailyCandleFinnhubKeys } from "../lib/data/adapters/finnhub-key-router";

test("daily Finnhub keys are deduplicated across one to four configured lanes", () => {
  const old = { ...process.env };
  process.env.FINNHUB_GLOBAL_MARKETS_API_KEY = "a";
  process.env.FINNHUB_SECTORS_HEATMAP_API_KEY = "a";
  process.env.FINNHUB_CRYPTO_HEATMAP_API_KEY = "b";
  process.env.FINNHUB_MACRO_HEATMAP_API_KEY = "c";
  try {
    assert.deepEqual(getDailyCandleFinnhubKeys().map(k => k.key), ["a", "b", "c"]);
  } finally {
    process.env = old;
  }
});

import { SP500_FUTURES_HISTORY_ID, SP500_FUTURES_HISTORY_URL, parseUnusualWhalesFuturesCandles, retainTrailingFuturesYear } from "../lib/data/unusual-whales-futures-candles";
import { marketCandleAssets } from "../lib/data/market-assets";

test("S&P 500 futures candle asset is enabled with centralized UUID metadata", () => {
  const asset = marketCandleAssets.find((a) => a.symbol === "ES=F");
  assert.equal(asset?.chartAvailable, true);
  assert.equal(asset?.label, "S&P 500 Futures");
  assert.equal(asset?.group, "indices");
  assert.equal(asset?.marketCalendar, "futures");
  assert.equal(asset?.futuresHistoryId, SP500_FUTURES_HISTORY_ID);
  assert.equal(asset?.finnhubSymbol, undefined);
  assert.equal(SP500_FUTURES_HISTORY_URL, "https://phx.unusualwhales.com/api/futures_eod_history/09abc102-cb07-420e-92c6-e220f44c1e81");
  assert.ok(!SP500_FUTURES_HISTORY_URL.includes("-USD"));
});

test("futures parser maps fields, preserves Sunday, skips Saturday, and derives previous close after sorting", () => {
  const result = parseUnusualWhalesFuturesCandles({ data: { history: [
    { date:"2026-07-09", open:6310.25, high:6342.5, low:6298.75, close:6331.0 },
    { date:"2026-07-05", open:"6300", high:"6320", low:"6290", close:"6310" },
    { date:"2026-07-04", open:1, high:2, low:1, close:2 },
    { date:"2026-07-10", open:10, high:9, low:8, close:9 }
  ] } }, "2026-07-10T00:00:00.000Z");
  assert.equal(result.arrayPath, "data.history");
  assert.equal(result.rawCount, 4);
  assert.equal(result.parsedCount, 2);
  assert.equal(result.saturdayRowsSkipped, 1);
  assert.deepEqual(result.candles.map(c=>c.tradingDate), ["2026-07-05", "2026-07-09"]);
  assert.equal(result.candles[0].volume, null);
  assert.equal(result.candles[1].previousClose, 6310);
});

test("futures one-year retention uses calendar-year boundary including leap days", () => {
  const rows = ["2024-02-28", "2024-02-29", "2025-02-28"].map((tradingDate, i) => ({ symbol:"ES=F", providerSymbol:SP500_FUTURES_HISTORY_ID, tradingDate, open:1, high:2, low:1, close:i+1, volume:null, previousClose:null, source:"Unusual Whales Futures EOD", sourceTimestamp:tradingDate, fetchedAt:tradingDate, assetGroup:"indices" }));
  assert.deepEqual(retainTrailingFuturesYear(rows).map(r=>r.tradingDate), ["2024-02-28", "2024-02-29", "2025-02-28"]);
});
