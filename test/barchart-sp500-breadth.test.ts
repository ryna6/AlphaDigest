import assert from "node:assert/strict";
import test from "node:test";
import {
  BARCHART_QUOTE_SOURCES,
  createBarchartSp500BreadthSnapshot,
  diagnoseBarchartQuoteHtml,
  parseBarchartQuoteValueHtml,
  validateBarchartBreadth,
  writeBarchartSp500BreadthSnapshot
} from "../lib/data/adapters/barchart-sp500-breadth";

const quoteFixture = (lastPrice: string, priceChange = "+10.00", percentChange = "+25.00%") => `
<html><body>
  <div data-ng-show="isReady &amp;&amp; item.lastPrice" class="pricechangerow">
    <span class="last-change" data-ng-class="highlightValue('lastPrice')">
      ${lastPrice}
    </span>
    <span data-ng-class="setColor(item.priceChange)" class="up">
      <span class="last-change" data-ng-class="highlightValue('priceChange')">${priceChange}</span>
      <span class="last-change" data-ng-show="item.percentChange">(<span data-ng-class="highlightValue('percentChange')">${percentChange}</span>)</span>
    </span>
    <span class="symbol-trade-time" data-ng-class="highlightValue('tradeTime')">07/02/26</span>
    <span class="symbol-trade-time">[INDEX]</span>
  </div>
</body></html>`;

test("parses successful .pricechangerow lastPrice value", () => {
  assert.equal(parseBarchartQuoteValueHtml(quoteFixture("50.00"), "$MAHP"), 50);
});

test("uses the direct-child lastPrice span instead of other .last-change values", () => {
  assert.equal(parseBarchartQuoteValueHtml(quoteFixture("50.00", "+999.00", "+888.00%"), "$MMFI"), 50);
});

test("does not select price change when multiple .last-change elements exist", () => {
  assert.notEqual(parseBarchartQuoteValueHtml(quoteFixture("67.06", "+10.00", "+25.00%"), "$MMFI"), 10);
});

test("does not select percent change when multiple .last-change elements exist", () => {
  assert.notEqual(parseBarchartQuoteValueHtml(quoteFixture("67.06", "+10.00", "+25.00%"), "$MMFI"), 25);
});

test("parses decimal quote values", () => {
  assert.equal(parseBarchartQuoteValueHtml(quoteFixture("67.06"), "$MMFI"), 67.06);
});

test("parses integer quote values", () => {
  assert.equal(parseBarchartQuoteValueHtml(quoteFixture("50"), "$MAHP"), 50);
});

test("trims surrounding whitespace and tolerates commas", () => {
  assert.equal(parseBarchartQuoteValueHtml(quoteFixture(" \n 1,234 \t "), "$MAHP"), 1234);
});

test("fails when .pricechangerow is missing", () => {
  assert.throws(() => parseBarchartQuoteValueHtml("<span class='last-change' data-ng-class=\"highlightValue('lastPrice')\">50</span>", "$MAHP"), /missing \.pricechangerow/);
});

test("fails when the direct lastPrice span is missing", () => {
  assert.throws(() => parseBarchartQuoteValueHtml(`<div class="pricechangerow"><span class="last-change" data-ng-class="highlightValue('priceChange')">+10</span></div>`, "$MAHP"), /missing .*lastPrice/);
});

test("fails for empty Angular-bound lastPrice span", () => {
  assert.throws(() => parseBarchartQuoteValueHtml(quoteFixture("   "), "$MMFI"), /lastPrice is not numeric/);
});

test("detects blocked or challenge HTML", () => {
  assert.throws(() => parseBarchartQuoteValueHtml("<html><title>Cloudflare</title>verify you are human captcha</html>", "$MMFI"), /block\/challenge/);
});

test("rejects malformed numeric value", () => {
  assert.throws(() => parseBarchartQuoteValueHtml(quoteFixture("50.00 points"), "$MMFI"), /not numeric/);
});

test("diagnostics report raw HTML parser facts without storing HTML", () => {
  const diagnostics = diagnoseBarchartQuoteHtml(quoteFixture("50.00"), BARCHART_QUOTE_SOURCES.MAHP.url, "$MAHP");
  assert.equal(diagnostics.hasPriceChangeRow, true);
  assert.equal(diagnostics.hasLastPriceSpan, true);
  assert.equal(diagnostics.hasNumericLastPrice, true);
  assert.equal(diagnostics.responseLength! > 0, true);
});

test("validation rejects out-of-range percentage values", () => {
  assert.throws(() => validateBarchartBreadth({ above50dPercent: 101, above200dPercent: 66, highs52w: 50, lows52w: 1, sourceUpdatedAt: null }), /outside 0-100/);
});

test("validation rejects non-integer 52-week counts", () => {
  assert.throws(() => validateBarchartBreadth({ above50dPercent: 50, above200dPercent: 66, highs52w: 50.5, lows52w: 1, sourceUpdatedAt: null }), /highs count is invalid/);
});

test("one failing symbol prevents a complete snapshot and therefore preserves the cached row", () => {
  assert.throws(() => createBarchartSp500BreadthSnapshot({ above50dPercent: 67.06, above200dPercent: 66.07, highs52w: 50, lows52w: Number.NaN, sourceUpdatedAt: null }), /lows count is invalid/);
});

test("validation prevents incomplete or bad Supabase writes before Supabase is called", async () => {
  let called = false;
  const client = { from: () => ({ upsert: async () => { called = true; return { error: null }; } }) } as never;
  await assert.rejects(() => writeBarchartSp500BreadthSnapshot(client, { id: "sp500", above50dPercent: 101, above200dPercent: 66, highs52w: 50, lows52w: 1, sourceUpdatedAt: null, sourceUrl: "https://www.barchart.com/stocks/quotes/$MMFI", fetchedAt: "2026-07-03T18:00:00.000Z", contentHash: "x" }), /outside 0-100/);
  assert.equal(called, false);
});

test("standalone validation rejects unreasonable component counts", () => {
  assert.throws(() => validateBarchartBreadth({ above50dPercent: 50, above200dPercent: 50, highs52w: 751, lows52w: 0, sourceUpdatedAt: null }), /unreasonable/);
});
