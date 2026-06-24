import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  centralTimestampToEasternIso,
  isExpectedCboeFetchWindow,
  parseCboePutCallFromHtml,
  parseCboeDailyPutCallFromHtml,
  cboeDailyPutCallUrl
} from "../lib/data/adapters/cboe-put-call";
import {
  normalizeCoinGeckoCryptoResponse,
  cryptoAssets
} from "../lib/data/adapters/coingecko-crypto";
import { shouldRunInTorontoWindow } from "../lib/schedule/toronto";
import { normalizeUnusualWhalesEarningsRows } from "../lib/data/adapters/unusual-whales-earnings";
import { stripUnusualWhalesAdSection } from "../lib/data/adapters/unusual-whales-news";



test("Unusual Whales ad stripper removes only the double-hr ad block and preserves article body", () => {
  const html = `<p>Lead section.</p>
    <hr>
    <p><strong>Want more market intelligence?</strong> <a href="https://unusualwhales.com/login?ref=blubber">Create your free Unusual Whales account</a></p>
    <hr/>
    <p>Follow-up section remains.</p>`;
  const cleaned = stripUnusualWhalesAdSection(html);
  assert.match(cleaned, /Lead section/);
  assert.match(cleaned, /Follow-up section remains/);
  assert.doesNotMatch(cleaned, /Create your free Unusual Whales account/);
});

test("Unusual Whales ad stripper removes exact trailing promo HTML", () => {
  const promo = `<p>Keep an eye on the <a href="https://unusualwhales.com/news?ref=unusual-whales.ghost.io">rest of the news flow</a> for any follow-on reporting from the New Yorker piece.</p><p><strong>Want more market intelligence?</strong> <a href="https://unusualwhales.com/login?ref=blubber">Create your free Unusual Whales account</a> for options flow, market tide, GEX, and the full toolkit.</p>`;
  const cleaned = stripUnusualWhalesAdSection(`<p>Real ending.</p>${promo}`);
  assert.equal(cleaned, `<p>Real ending.</p>`);
});

test("Cboe daily fallback URL includes Toronto date query", () => {
  assert.equal(
    cboeDailyPutCallUrl(new Date("2026-06-23T15:00:00.000Z")),
    "https://www.cboe.com/markets/us/options/market-statistics/daily/?dt=2026-06-23"
  );
});

test("Cboe parser reads equity, index, and total ratios from the market-statistics section only", () => {
  const html = readFileSync("test/fixtures/cboe-market-statistics.html", "utf8");
  const parsed = parseCboePutCallFromHtml(html, "2026-06-12T15:36:00.000Z");
  assert.equal(parsed?.source, "cboe");
  assert.equal(parsed?.freshness, "live_intraday");
  assert.deepEqual(parsed?.ratios, { equity: 0.55, index: 1.25, total: 0.91 });
  assert.equal(parsed?.value, 0.91);
  assert.equal(parsed?.raw?.heading, "Cboe Exchange Market Statistics for Friday, June 12, 2026");
  assert.equal(parsed?.raw?.sourceTimezone, "America/Chicago");
  assert.equal(parsed?.raw?.displayTimezone, "America/Toronto");
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
      <tr><td>TOTAL PUT/CALL RATIO</td><td>0.69</td></tr>
      <tr><td>INDEX PUT/CALL RATIO</td><td>1.11</td></tr>
      <tr><td>EQUITY PUT/CALL RATIO</td><td>0.55</td></tr>
    </table>
  `;
  const parsed = parseCboeDailyPutCallFromHtml(html, "2026-06-19T02:30:00.000Z");
  assert.equal(parsed?.freshness, "previous_close");
  assert.deepEqual(parsed?.ratios, { equity: 0.55, index: 1.11, total: 0.69 });
  assert.equal(parsed?.value, 0.69);
});

test("Central to Eastern conversion handles standard time and daylight time", () => {
  assert.equal(centralTimestampToEasternIso("2026-01-12", "9:30 AM"), "2026-01-12T15:30:00.000Z");
  assert.equal(centralTimestampToEasternIso("2026-06-12", "9:30 AM"), "2026-06-12T14:30:00.000Z");
});

test("Cboe scheduler gate allows half-hour fetches from 9:00 AM through 3:30 PM Central on weekdays", () => {
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T14:00:00.000Z")), true);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T20:30:00.000Z")), true);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T14:05:00.000Z")), false);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T13:30:00.000Z")), false);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-12T21:00:00.000Z")), false);
  assert.equal(isExpectedCboeFetchWindow(new Date("2026-06-13T14:00:00.000Z")), false);
});

test("Toronto weekday-only Flow guard allows late hourly wakes without interval skips", () => {
  const tuesdayLateWake = new Date("2026-06-23T05:15:05.000Z");
  const decision = shouldRunInTorontoWindow({ days: [1, 2, 3, 4, 5], now: tuesdayLateWake });
  assert.equal(decision.shouldRun, true);
  assert.equal(decision.reason, "scheduled_toronto_window");
  assert.equal(decision.torontoTime, "Tue 2026-06-23 01:15:05");
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

test("Unusual Whales earnings normalization suppresses duplicate same-ticker unknown variants only when a dated row exists", () => {
  const rows = [
    { symbol: "AVAV", full_name: "AeroVironment", report_date: "2026-06-23", report_time: null, marketcap: 5_000_000_000, country_code: "US" },
    { symbol: "AVAV", full_name: "AeroVironment", report_date: "2026-06-23", report_time: "postmarket", marketcap: 5_000_000_000, country_code: "US" },
    { symbol: "ONLY", full_name: "Only Unknown", report_date: "2026-06-23", report_time: null, marketcap: 5_000_000_000, country_code: "US" }
  ];

  const events = normalizeUnusualWhalesEarningsRows(rows, "2026-06-23T00:00:00.000Z");
  assert.deepEqual(events.map((event) => event.id).sort(), [
    "uw-earnings:AVAV:2026-06-23:postmarket",
    "uw-earnings:ONLY:2026-06-23:unknown"
  ]);
});
