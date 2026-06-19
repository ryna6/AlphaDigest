import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  centralTimestampToEasternIso,
  isExpectedCboeFetchWindow,
  parseCboePutCallFromHtml,
  parseCboeDailyPutCallFromHtml
} from "../lib/data/adapters/cboe-put-call";
import {
  normalizeCoinGeckoCryptoResponse,
  cryptoAssets
} from "../lib/data/adapters/coingecko-crypto";

test("Cboe parser reads equity, index, and total ratios from the market-statistics section only", () => {
  const html = readFileSync("test/fixtures/cboe-market-statistics.html", "utf8");
  const parsed = parseCboePutCallFromHtml(html, "2026-06-12T15:36:00.000Z");
  assert.equal(parsed?.source, "cboe");
  assert.equal(parsed?.freshness, "live_intraday");
  assert.deepEqual(parsed?.ratios, { equity: 0.55, index: 1.25, total: 0.91 });
  assert.equal(parsed?.value, 0.91);
  assert.equal(parsed?.raw?.heading, "Cboe Exchange Market Statistics for Friday, June 12, 2026");
  assert.equal(parsed?.raw?.sourceTimezone, "America/Chicago");
  assert.equal(parsed?.raw?.displayTimezone, "America/New_York");
  assert.equal(parsed?.raw?.sourceAsOfCentral, "2026-06-12T09:30:00[America/Chicago]");
  assert.equal(parsed?.raw?.asOfEastern, "2026-06-12T14:30:00.000Z");
});

test("Cboe parser preserves available ratios when one ratio is missing", () => {
  const html = readFileSync("test/fixtures/cboe-market-statistics.html", "utf8").replace(
    /<tr>\s*<td>Equity Options<\/td>\s*<td>400<\/td>\s*<td>220<\/td>\s*<td>620<\/td>\s*<td>0.55<\/td>\s*<\/tr>/,
    ""
  );
  const parsed = parseCboePutCallFromHtml(html, "2026-06-12T15:36:00.000Z");
  assert.deepEqual(parsed?.ratios, { equity: null, index: 1.25, total: 0.91 });
});

test("Cboe parser returns null when target market-statistics section is missing", () => {
  const parsed = parseCboePutCallFromHtml("<h2>Volume Summary</h2><table></table>");
  assert.equal(parsed, null);
});

test("Cboe daily parser reads official ratio table as fallback", () => {
  const html = `
    <h1>Cboe Daily Market Statistics</h1>
    <table>
      <tr><th>Ratios</th><th>Value</th></tr>
      <tr><td>TOTAL PUT/CALL RATIO</td><td>0.91</td></tr>
      <tr><td>INDEX PUT/CALL RATIO</td><td>1.17</td></tr>
      <tr><td>EQUITY PUT/CALL RATIO</td><td>0.58</td></tr>
    </table>
  `;
  const parsed = parseCboeDailyPutCallFromHtml(html, "2026-06-19T02:30:00.000Z");
  assert.equal(parsed?.freshness, "previous_close");
  assert.deepEqual(parsed?.ratios, { equity: 0.58, index: 1.17, total: 0.91 });
  assert.equal(parsed?.value, 0.91);
});

test("Central to Eastern conversion handles standard time and daylight time", () => {
  assert.equal(centralTimestampToEasternIso("2026-01-12", "9:30 AM"), "2026-01-12T15:30:00.000Z");
  assert.equal(centralTimestampToEasternIso("2026-06-12", "9:30 AM"), "2026-06-12T14:30:00.000Z");
});

test("Cboe scheduler gate allows only 9:05 AM through 3:35 PM Central on weekdays", () => {
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T14:05:00.000Z")), true);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T20:35:00.000Z")), true);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T14:00:00.000Z")), false);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T13:35:00.000Z")), false);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T21:05:00.000Z")), false);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-13T14:05:00.000Z")), false);
});

test("CoinGecko normalization requires every configured current USD crypto quote", () => {
  const fixture = Object.fromEntries(
    cryptoAssets.map((asset, index) => [
      asset.id,
      { usd: 100 + index, usd_24h_change: index - 2, last_updated_at: 1_781_287_200 }
    ])
  );
  const quotes = normalizeCoinGeckoCryptoResponse(fixture, "2026-06-13T00:00:00.000Z");
  assert.equal(quotes.length, cryptoAssets.length);
  assert.equal(quotes[0].symbol, "BTCUSD");
  assert.equal(quotes[0].price, 100);
  assert.equal(quotes[0].changePercent24h, -2);
});
