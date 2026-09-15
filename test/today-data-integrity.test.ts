import assert from "node:assert/strict";
import test from "node:test";
import {
  leadingSectorsDescription,
  sectorChangeClass,
  sectorChangeText
} from "../components/dashboard/today/today-view";
import { getMajorEarningsForDate, sortByMarketCapDesc } from "../lib/data/earnings-utils";
import type { UnusualWhalesEarningsEvent } from "../lib/data/schemas/dashboard";

test("leading sectors use independent positive, neutral, negative and unavailable styles", () => {
  assert.deepEqual([1.2, 0, -0.3, null].map(sectorChangeClass), [
    "text-positive",
    "text-textSecondary",
    "text-negative",
    "text-textMuted"
  ]);
  assert.deepEqual([1.2, 0, -0.3, null].map(sectorChangeText), ["+1.20%", "0.00%", "-0.30%", "—"]);
});

test("leading sectors accessibility describes direction without relying on color", () => {
  assert.equal(
    leadingSectorsDescription([
      { symbol: "XLK", label: "Technology", changePercent: 1.42 },
      { symbol: "XLF", label: "Financials", changePercent: 0 },
      { symbol: "XLE", label: "Energy", changePercent: -0.31 }
    ]),
    "Technology up 1.42 percent, Financials unchanged 0.00 percent, Energy down 0.31 percent"
  );
});

const earning = (
  symbol: string,
  reportDate: string,
  marketCap: number | null,
  reportTime: string | null
): UnusualWhalesEarningsEvent => ({
  source: "unusual_whales_earnings",
  id: `uw-earnings:${symbol}:${reportDate}:${reportTime ?? "unknown"}`,
  symbol,
  companyName: symbol,
  logo: null,
  reportDate,
  reportTime,
  isSp500: false,
  marketCapSize: "large",
  marketCap,
  callVolume: null,
  putVolume: null,
  impliedMovePct: null,
  contentHash: symbol,
  fetchedAt: "2026-07-30T12:00:00Z"
});

test("Today earnings selects the matching date, minimum cap, descending top five and preserves sessions", () => {
  const rows = [
    earning("F", "2026-07-30", 6e9, null),
    earning("A", "2026-07-30", 11e9, "premarket"),
    earning("B", "2026-07-30", 10e9, "postmarket"),
    earning("C", "2026-07-30", 9e9, null),
    earning("D", "2026-07-30", 8e9, null),
    earning("E", "2026-07-30", 7e9, null),
    earning("SMALL", "2026-07-30", 3e9, null),
    earning("OTHER", "2026-07-31", 99e9, null)
  ];
  assert.deepEqual(
    getMajorEarningsForDate(rows, "2026-07-30", 5).map((row) => row.symbol),
    ["A", "B", "C", "D", "E"]
  );
  assert.deepEqual(
    rows.slice(0, 3).map((row) => row.reportTime),
    [null, "premarket", "postmarket"]
  );
});

test("null market caps sort deterministically after valid caps", () => {
  const rows = [
    earning("NULL", "2026-07-30", null, null),
    earning("VALID", "2026-07-30", 5e9, null)
  ];
  assert.deepEqual(
    sortByMarketCapDesc(rows).map((row) => row.symbol),
    ["VALID", "NULL"]
  );
});
