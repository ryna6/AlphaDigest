import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  normalizeTickerRow,
  selectLatestCompleteInstitutionalSummaryPeriod,
  type InstitutionalSectorExposureRow,
  type InstitutionalTickerFlowRow
} from "../lib/data/adapters/unusual-whales-institutional";

const sectors = [
  "XLB (Materials)",
  "XLE (Energy)",
  "XLF (Financials)",
  "XLI (Industrials)",
  "XLK (Technology)",
  "XLP (Consumer Staples)",
  "XLU (Utilities)",
  "XLV (Health Care)",
  "XLY (Consumer Discretionary)",
  "XLC (Communications)",
  "XLRE (Real Estate)"
];
const orders = ["holding_count", "increased_positions_and_units", "decreased_positions_and_units"];
function ticker(reportDate: string, order: string, value: number | null = 100): InstitutionalTickerFlowRow {
  return {
    investorType: "value",
    order,
    ticker: `${order.slice(0, 2)}${reportDate.slice(5, 7)}`.toUpperCase(),
    reportDate,
    value,
    increasedPositions: 1,
    decreasedPositions: 1,
    holdingCount: 1,
    units: 1,
    prevUnits: 1,
    fetchedAt: "2026-07-12T00:00:00.000Z"
  };
}
function tickerSet(reportDate: string) {
  return orders.map((order) => ticker(reportDate, order));
}
function sectorSet(reportDate: string, value: number | null = 10, count = sectors.length): InstitutionalSectorExposureRow[] {
  return sectors.slice(0, count).map((sector) => ({
    investorType: "value",
    sector,
    value,
    reportDate,
    fetchedAt: "2026-07-12T00:00:00.000Z"
  }));
}

test("ticker-flow normalization parses and preserves provider report_date", () => {
  const row = normalizeTickerRow({ ticker: "aapl", value: "0", report_date: "2026-03-31" }, "value", "holding_count", "2026-07-12T00:00:00.000Z");
  assert.equal(row?.ticker, "AAPL");
  assert.equal(row?.reportDate, "2026-03-31");
  assert.equal(row?.value, 0);
});

test("ticker-flow persistence includes report_date in schema, migration, query, and conflict target", () => {
  const adapter = fs.readFileSync("lib/data/adapters/unusual-whales-institutional.ts", "utf8");
  const migration = fs.readFileSync("supabase/migrations/0030_institutional_ticker_flow_report_date.sql", "utf8");
  assert.match(adapter, /report_date: row\.reportDate/);
  assert.match(adapter, /onConflict: "investor_type,order,ticker,report_date"/);
  assert.match(adapter, /select\(\s*"investor_type,order,ticker,report_date/);
  assert.match(migration, /add column if not exists report_date date/);
  assert.match(migration, /primary key \(investor_type, "order", ticker, report_date\)/);
});

test("latest quarter is selected when ticker-flow categories and sectors are complete", () => {
  const result = selectLatestCompleteInstitutionalSummaryPeriod({
    investorType: "value",
    tickerFlow: [...tickerSet("2026-06-30"), ...tickerSet("2026-03-31")],
    sectorExposure: [...sectorSet("2026-06-30"), ...sectorSet("2026-03-31")]
  });
  assert.equal(result.selectedReportDate, "2026-06-30");
});

test("latest quarter missing one ticker-flow category falls back to previous complete quarter", () => {
  const result = selectLatestCompleteInstitutionalSummaryPeriod({
    investorType: "value",
    tickerFlow: [ticker("2026-06-30", "holding_count"), ticker("2026-06-30", "increased_positions_and_units"), ...tickerSet("2026-03-31")],
    sectorExposure: [...sectorSet("2026-06-30"), ...sectorSet("2026-03-31")]
  });
  assert.equal(result.selectedReportDate, "2026-03-31");
  assert.match(result.rejectedPeriods["2026-06-30"].join(" "), /decreased_positions_and_units/);
});

test("latest quarter containing only some sectors falls back to previous complete quarter", () => {
  const result = selectLatestCompleteInstitutionalSummaryPeriod({
    investorType: "value",
    tickerFlow: [...tickerSet("2026-06-30"), ...tickerSet("2026-03-31")],
    sectorExposure: [...sectorSet("2026-06-30", 10, 5), ...sectorSet("2026-03-31")]
  });
  assert.equal(result.selectedReportDate, "2026-03-31");
  assert.match(result.rejectedPeriods["2026-06-30"].join(" "), /incomplete sector rows/);
});

test("missing sector values do not become zero and explicit provider zero remains valid", () => {
  const nullValue = selectLatestCompleteInstitutionalSummaryPeriod({
    investorType: "value",
    tickerFlow: [...tickerSet("2026-06-30"), ...tickerSet("2026-03-31")],
    sectorExposure: [...sectorSet("2026-06-30", null), ...sectorSet("2026-03-31", 0)]
  });
  assert.equal(nullValue.selectedReportDate, "2026-03-31");
  const explicitZero = selectLatestCompleteInstitutionalSummaryPeriod({
    investorType: "value",
    tickerFlow: tickerSet("2026-06-30"),
    sectorExposure: sectorSet("2026-06-30", 0)
  });
  assert.equal(explicitZero.selectedReportDate, "2026-06-30");
});

test("whole-card fallback prevents mixed report periods", () => {
  const selected = selectLatestCompleteInstitutionalSummaryPeriod({
    investorType: "value",
    tickerFlow: [...tickerSet("2026-06-30"), ...tickerSet("2026-03-31")],
    sectorExposure: [...sectorSet("2026-06-30", 10, 5), ...sectorSet("2026-03-31")]
  }).selectedReportDate;
  const displayedTicker = [...tickerSet("2026-06-30"), ...tickerSet("2026-03-31")].filter((row) => row.reportDate === selected);
  const displayedSectors = [...sectorSet("2026-06-30", 10, 5), ...sectorSet("2026-03-31")].filter((row) => row.reportDate === selected);
  assert.equal(selected, "2026-03-31");
  assert.equal(new Set([...displayedTicker, ...displayedSectors].map((row) => row.reportDate)).size, 1);
});
