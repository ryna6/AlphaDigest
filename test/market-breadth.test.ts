import assert from "node:assert/strict";
import test from "node:test";
import {
  createMarketBreadthSnapshot,
  diagnoseInvestingHtml,
  intersectWithSp500,
  normalizeTicker,
  parseInvestingCurrentValue,
  parseYahooScreenerSymbols,
  validateMarketBreadth,
  writeMarketBreadthSnapshot
} from "../lib/data/adapters/market-breadth";

const investingFixture = (value: string, change = "+1.20", pct = "+2.40%", name = "S&P 500 Stocks Above 50 Day Average") => `
<html><head><script type="application/ld+json">{"name":"${name}","last_price":"${value}","change":"${change}","percentChange":"${pct}"}</script></head>
<body><h1>${name}</h1><div data-test="instrument-price-last">${value}</div><span>${change}</span><span>${pct}</span></body></html>`;

test("Investing parser extracts successful current value", () => {
  assert.equal(parseInvestingCurrentValue(investingFixture("67.06"), "S&P 500 Stocks Above 50 Day Average"), 67.06);
});

test("Investing parser uses main value instead of daily change or percent change", () => {
  assert.equal(parseInvestingCurrentValue(investingFixture("50", "+99.00", "+88.00%"), "S&P 500 Stocks Above 50 Day Average"), 50);
});

test("Investing parser supports embedded JSON decimal and integer values", () => {
  assert.equal(parseInvestingCurrentValue(investingFixture("66.5"), "S&P 500 Stocks Above 50 Day Average"), 66.5);
  assert.equal(parseInvestingCurrentValue(investingFixture("66"), "S&P 500 Stocks Above 50 Day Average"), 66);
});

test("Investing parser fails on missing current value", () => {
  assert.throws(() => parseInvestingCurrentValue("<html><h1>S&P 500 Stocks Above 50 Day Average</h1></html>", "S&P 500 Stocks Above 50 Day Average"), /missing|match|expected/);
});

test("Investing parser fails on wrong instrument", () => {
  assert.throws(() => parseInvestingCurrentValue(investingFixture("50", "+1", "+1%", "NASDAQ Breadth"), "S&P 500 Stocks Above 50 Day Average"), /does not match/);
});

test("Investing diagnostics detect consent and challenge pages", () => {
  assert.equal(diagnoseInvestingHtml("<html>Privacy choices accept cookies</html>", "u", "S&P 500 Stocks Above 50 Day Average").appearsConsent, true);
  assert.equal(diagnoseInvestingHtml("<html>Cloudflare captcha verify you are human</html>", "u", "S&P 500 Stocks Above 50 Day Average").appearsBlocked, true);
});

test("Market breadth validation rejects out-of-range percentage", () => {
  assert.throws(() => validateMarketBreadth({ above50dPercent: 101, above200dPercent: 66, highs52w: 1, lows52w: 2, sourceUpdatedAt: null, movingAverageSource: "Investing.com", highLowSource: "Yahoo" }), /outside 0-100/);
});

test("Yahoo screener parser extracts equities, excludes ETFs/funds, and removes duplicates", () => {
  const parsed = parseYahooScreenerSymbols({ finance: { result: [{ quotes: [{ symbol: "AAPL", quoteType: "EQUITY" }, { symbol: "AAPL", quoteType: "EQUITY" }, { symbol: "SPY", quoteType: "ETF" }, { symbol: "BRK.B", quoteType: "EQUITY" }], total: 4 }] } });
  assert.deepEqual([...parsed.symbols].sort(), ["AAPL", "BRK-B"]);
  assert.equal(parsed.total, 4);
});

test("Yahoo parser handles empty and malformed responses", () => {
  assert.equal(parseYahooScreenerSymbols({ quotes: [] }).symbols.size, 0);
  assert.equal(parseYahooScreenerSymbols(null).symbols.size, 0);
});

test("ticker normalization handles class-share punctuation", () => {
  assert.equal(normalizeTicker("brk.b"), "BRK-B");
  assert.equal(normalizeTicker("BF-B"), "BF-B");
});

test("Yahoo symbols are intersected with unique S&P 500 constituents", () => {
  const matches = intersectWithSp500(new Set(["AAPL", "BRK-B", "SPY", "ZZZ"]), [{ ticker: "AAPL" }, { ticker: "BRK.B" }]);
  assert.deepEqual(matches.sort(), ["AAPL", "BRK-B"]);
});

test("one incomplete source prevents database write", async () => {
  let called = false;
  const client = { from: () => ({ upsert: async () => { called = true; return { error: null }; } }) } as never;
  await assert.rejects(() => writeMarketBreadthSnapshot(client, { id: "sp500", above50dPercent: 50, above200dPercent: Number.NaN, highs52w: 2, lows52w: 1, sourceUpdatedAt: null, movingAverageSource: "Investing.com", highLowSource: "Yahoo", sourceUrl: "u", fetchedAt: "2026-07-03T00:00:00.000Z", contentHash: "x" }), /outside 0-100/);
  assert.equal(called, false);
});

test("complete snapshots target market_breadth and preserve valid cache semantics", async () => {
  const snapshot = createMarketBreadthSnapshot({ above50dPercent: 50, above200dPercent: 60, highs52w: 3, lows52w: 1, sourceUpdatedAt: null, movingAverageSource: "Investing.com", highLowSource: "Yahoo Finance filtered to cached S&P 500 constituents" }, "2026-07-03T00:00:00.000Z");
  let table = "";
  const client = { from: (name: string) => { table = name; return { upsert: async () => ({ error: null }) }; } } as never;
  await writeMarketBreadthSnapshot(client, snapshot);
  assert.equal(table, "market_breadth");
});
