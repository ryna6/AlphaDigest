import assert from "node:assert/strict";
import test from "node:test";
import { parseMarketMoverValue } from "../lib/data/market-movers-display";
import {
  signedPositionChange,
  positionChangePercentFromUnits
} from "../lib/data/institution-position-change";
import { DARK_POOL_RETENTION_DAYS } from "../lib/data/adapters/unusual-whales-dark-pool";
import { WHALE_FEED_RETENTION_DAYS } from "../lib/data/adapters/unusual-whales-whale-feed";
import { deriveFlowSummary, DARK_POOL_SUMMARY_WINDOW_DAYS } from "../lib/data/flow-summary";
import type { DarkPoolFlowRow, WhaleFeedRow } from "../lib/data/schemas/dashboard";

const now = new Date("2026-07-03T12:00:00.000Z").getTime();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

test("Market Movers parser supports structured leaders and laggards rows", () => {
  assert.deepEqual(parseMarketMoverValue("GPC +12.91% · XYZ +8.42%"), [
    { ticker: "GPC", percent: "+12.91%" },
    { ticker: "XYZ", percent: "+8.42%" }
  ]);
  assert.deepEqual(parseMarketMoverValue("ABC -9.25% · DEF -7.18%"), [
    { ticker: "ABC", percent: "-9.25%" },
    { ticker: "DEF", percent: "-7.18%" }
  ]);
});

test("Market Movers UI keeps ticker neutral and colors only percentage values", () => {
  const source = new TextDecoder().decode(
    new Uint8Array(require("node:fs").readFileSync("components/dashboard/markets/markets-view.tsx"))
  );
  assert.match(source, /row\.ticker[\s\S]*text-textPrimary/);
  assert.match(source, /isNegative[\s\S]*text-negative[\s\S]*text-positive/);
  assert.match(source, /tabular/);
});

test("Flow source retention constants keep Dark Pool for 14 days and Whale Feed for 30 days", () => {
  assert.equal(DARK_POOL_RETENTION_DAYS, 14);
  assert.equal(WHALE_FEED_RETENTION_DAYS, 30);
});

test("Flow Summary largest Dark Pool print excludes prints older than 14 days", () => {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const darkPool = [
      {
        ticker: "OLD",
        premium: 999_000_000,
        executedAt: daysAgo(20),
        size: 100,
        avg30Volume: 1000
      },
      { ticker: "NEW", premium: 10_000_000, executedAt: daysAgo(2), size: 100, avg30Volume: 1000 }
    ] as DarkPoolFlowRow[];
    const summary = deriveFlowSummary({ darkPool, insiderRows: [], whaleTrades: [] });
    const largest = summary.find(
      (row) => row.label === `Largest Dark Pool Print (${DARK_POOL_SUMMARY_WINDOW_DAYS}D)`
    );
    assert.equal(largest?.value, "NEW");
  } finally {
    Date.now = originalNow;
  }
});

test("Whale Feed rows retain 30-day constant without changing visible 14-day summary window", () => {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const whaleTrades = [
      { ticker: "OLDER", premium: 50_000_000, executedAt: daysAgo(20), sentiment: "bullish" },
      { ticker: "RECENT", premium: 1_000_000, executedAt: daysAgo(1), sentiment: "bearish" }
    ] as WhaleFeedRow[];
    const summary = deriveFlowSummary({ darkPool: [], insiderRows: [], whaleTrades });
    const whale = summary.find((row) => row.label === "Whale Feed (14D)");
    assert.equal(whale?.value, "RECENT");
  } finally {
    Date.now = originalNow;
  }
});

test("Institution holding percent change uses position units, not portfolio-level change", () => {
  assert.equal(positionChangePercentFromUnits(125_000, 25_000), 25);
  assert.equal(positionChangePercentFromUnits(0, -100_000), -100);
  assert.equal(positionChangePercentFromUnits(50_000, 50_000), null);
  assert.equal(positionChangePercentFromUnits(100_000, null), null);
  assert.equal(positionChangePercentFromUnits(Number.NaN, 1), null);
});

test("Institution holding absolute Change formatting signs only positive values", () => {
  assert.equal(signedPositionChange(25_000), "+25K");
  assert.equal(signedPositionChange(-12_500), "-12.5K");
  assert.equal(signedPositionChange(0), "0");
  assert.equal(signedPositionChange(null), "—");
});

test("Markets UI renders three desktop cards in order and Market Watch states", () => {
  const source = new TextDecoder().decode(
    new Uint8Array(require("node:fs").readFileSync("components/dashboard/markets/markets-view.tsx"))
  );
  assert.match(source, /md:grid-cols-2 xl:grid-cols-3/);
  assert.ok(source.indexOf('title="Market Breadth"') < source.indexOf('title="Market Movers"'));
  assert.ok(
    source.indexOf('title="Market Movers"') <
      source.indexOf("<MarketWatchCard marketWatch={data.marketWatch} />")
  );
  assert.match(source, /52W Highs/);
  assert.match(source, /52W Lows/);
  assert.match(source, /200D MA Crosses/);
  assert.match(source, /200W MA Crosses/);
  assert.match(source, /Insufficient history/);
  assert.match(source, />—</);
});

test("Advancers and Decliners render accessible colored triangles with safe fallback", () => {
  const source = new TextDecoder().decode(
    new Uint8Array(require("node:fs").readFileSync("components/dashboard/markets/markets-view.tsx"))
  );
  assert.match(source, /aria-label=\{`\$\{advancers\} advancers, \$\{decliners\} decliners`\}/);
  assert.match(source, /className="text-positive">▲/);
  assert.match(source, /className="text-negative">▼/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /if \(!match\) return <MetricRow metric=\{metric\} density="roomy" \/>/);
});
