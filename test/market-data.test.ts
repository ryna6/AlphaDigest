import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  centralTimestampToEasternIso,
  isExpectedCboeFetchWindow,
  parseCboePutCallFromHtml
} from "../lib/data/adapters/cboe-put-call";
import {
  normalizeCoinGeckoCryptoResponse,
  cryptoAssets
} from "../lib/data/adapters/coingecko-crypto";

test("Cboe parser reads Total row P/C Ratio and converts Central release time to Eastern", () => {
  const html = readFileSync("test/fixtures/cboe-market-statistics.html", "utf8");
  const parsed = parseCboePutCallFromHtml(html, "2026-06-12T15:36:00.000Z");
  assert.equal(parsed?.value, 0.91);
  assert.equal(parsed?.ratioType, "total");
  assert.equal(parsed?.sourceTimezone, "America/Chicago");
  assert.equal(parsed?.displayTimezone, "America/New_York");
  assert.equal(parsed?.sourceAsOfCentral, "2026-06-12T09:30:00[America/Chicago]");
  assert.equal(parsed?.asOfEastern, "2026-06-12T14:30:00.000Z");
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
