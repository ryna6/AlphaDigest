import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseBarchartSp500Breadth, validateBarchartBreadth, writeBarchartSp500BreadthSnapshot } from "../lib/data/adapters/barchart-sp500-breadth";

const renderedFixture = readFileSync("test/fixtures/barchart-sp500-rendered-minimal.html", "utf8");
const fixture = (ma = renderedFixture.match(/<section>[\s\S]*?<\/section>/)?.[0] ?? "", header = "52-Week") => `
  ${ma.includes("Percentage of S&P 500 Stocks Above Moving Average") ? ma : `<h4>Percentage of S&P 500 Stocks Above Moving Average</h4><div>${ma}</div>`}
  <h4>Summary of S&P 500 Stocks With New Highs and Lows</h4>
  <table>
    <tr><th>(501 Total Components)</th><th>5-Day</th><th>1-Month</th><th>3-Month</th><th>6-Month</th><th>${header}</th><th>Year-to-Date</th></tr>
    <tr><td>Today's New Highs (% of total)</td><td>247 (49%)</td><td>150 (30%)</td><td>95 (19%)</td><td>60 (12%)</td><td>50 (10%)</td><td>60 (12%)</td></tr>
    <tr><td>Today's New Lows (% of total)</td><td>102 (20%)</td><td>41 (8%)</td><td>11 (2%)</td><td>2 (0%)</td><td>1 (0%)</td><td>2 (0%)</td></tr>
    <tr><td>Difference</td><td>145</td><td>109</td><td>84</td><td>58</td><td>49</td><td>58</td></tr>
  </table>`;

test("parses rendered Angular chart-block moving-average values and 52-week counts", () => {
  const parsed = parseBarchartSp500Breadth(renderedFixture, "2026-07-03T18:00:00.000Z");
  assert.equal(parsed.above50dPercent, 67.06);
  assert.equal(parsed.above200dPercent, 66.07);
  assert.equal(parsed.highs52w, 50);
  assert.equal(parsed.lows52w, 1);
});

test("parses chart-block headings case-insensitively", () => {
  const html = renderedFixture.replace("50-Day Average", "50-day average").replace("200-Day Average", "200 DAY AVERAGE");
  const parsed = parseBarchartSp500Breadth(html);
  assert.equal(parsed.above50dPercent, 67.06);
  assert.equal(parsed.above200dPercent, 66.07);
});

test("normalizes non-breaking hyphens in chart-block headings", () => {
  const html = renderedFixture.replace("50-Day Average", "50‑Day Average").replace("200-Day Average", "200‑Day Average");
  const parsed = parseBarchartSp500Breadth(html);
  assert.equal(parsed.above50dPercent, 67.06);
  assert.equal(parsed.above200dPercent, 66.07);
});

test("extracts percentage from span text before the literal percent sign", () => {
  assert.equal(parseBarchartSp500Breadth(renderedFixture).above50dPercent, 67.06);
});

test("fails for unrendered Angular chart blocks with empty bound spans", () => {
  const html = renderedFixture.replace(/>67\.06<|>66\.07</g, "><");
  assert.throws(() => parseBarchartSp500Breadth(html), /50-day|200-day/);
});

test("extracts the first numeric count from the 52-week column only", () => {
  const parsed = parseBarchartSp500Breadth(renderedFixture);
  assert.equal(parsed.highs52w, 50);
  assert.equal(parsed.lows52w, 1);
});

test("fails when 50D chart block is missing", () => {
  assert.throws(() => parseBarchartSp500Breadth(fixture("200-DAY AVERAGE 66.07%")), /50-day/);
});

test("fails when 200D chart block is missing", () => {
  assert.throws(() => parseBarchartSp500Breadth(fixture("50-DAY AVERAGE 67.06%")), /200-day/);
});

test("fails when 52-Week column is missing", () => {
  assert.throws(() => parseBarchartSp500Breadth(fixture(undefined, "Year")), /52-week|52-Week/i);
});

test("detects blocked or challenge HTML", () => {
  assert.throws(() => parseBarchartSp500Breadth("<html><title>Cloudflare</title>verify you are human captcha</html>"), /block\/challenge/);
});

test("validation prevents incomplete or bad Supabase writes before Supabase is called", async () => {
  let called = false;
  const client = { from: () => ({ upsert: async () => { called = true; return { error: null }; } }) } as never;
  await assert.rejects(() => writeBarchartSp500BreadthSnapshot(client, { id: "sp500", above50dPercent: 101, above200dPercent: 66, highs52w: 50, lows52w: 1, sourceUpdatedAt: null, sourceUrl: "https://www.barchart.com/stocks/indices/sp/sp500", fetchedAt: "2026-07-03T18:00:00.000Z", contentHash: "x" }), /outside 0-100/);
  assert.equal(called, false);
});

test("standalone validation rejects unreasonable component counts", () => {
  assert.throws(() => validateBarchartBreadth({ above50dPercent: 50, above200dPercent: 50, highs52w: 751, lows52w: 0, sourceUpdatedAt: null }), /unreasonable/);
});
