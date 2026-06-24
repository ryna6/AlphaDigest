import { createServerSupabaseClient } from "@/lib/db/supabase";
import { extractArrayFromUnusualWhalesResponse } from "./unusual-whales-dark-pool";

export const institutionalInvestorTypes = [
  { value: "value", label: "Value", slug: "value_investor" },
  { value: "activist", label: "Activist", slug: "activist" },
  { value: "13d_activist", label: "13D Activist", slug: "13d_activist" },
  { value: "tiger_cub", label: "Tiger Cub", slug: "tiger_club" }
] as const;

export const institutionalPositionOrders = [
  { value: "increased", label: "Increased", order: "increased_positions_and_units" },
  { value: "decreased", label: "Decreased", order: "decreased_positions_and_units" },
  { value: "new", label: "New", order: "new_positions" },
  { value: "sold_out", label: "Sold Out", order: "sold_out_positions" }
] as const;

export const TOP_HOLDINGS_ORDER = "holding_count";
const SOURCE_TICKER_FLOW = "unusual_whales_institutional_ticker_flow";
const SOURCE_SECTOR_EXPOSURE = "unusual_whales_institutional_sector_exposure";
const SECTOR_EXPOSURE_QUARTERS_RETAINED = 5;

const stateStreetSectorMeta = [
  { label: "XLB (Materials)", name: "Materials", codes: ["XLB", "MATERIALS", "BASIC MATERIALS"] },
  { label: "XLE (Energy)", name: "Energy", codes: ["XLE", "ENERGY"] },
  {
    label: "XLF (Financials)",
    name: "Financials",
    codes: ["XLF", "FINAN", "FINANCIALS", "FINANCIAL SERVICES", "FINANCE"]
  },
  { label: "XLI (Industrials)", name: "Industrials", codes: ["XLI", "INDUSTRIALS"] },
  {
    label: "XLK (Technology)",
    name: "Technology",
    codes: ["XLK", "TECHNOLOGY", "TECH", "INFORMATION TECHNOLOGY"]
  },
  {
    label: "XLP (Consumer Staples)",
    name: "Consumer Staples",
    codes: ["XLP", "CONSUMER STAPLES", "STAPLES", "CONSUMER DEFENSIVE"]
  },
  { label: "XLU (Utilities)", name: "Utilities", codes: ["XLU", "UTILITIES"] },
  { label: "XLV (Health Care)", name: "Health Care", codes: ["XLV", "HEALTH CARE", "HEALTHCARE"] },
  {
    label: "XLY (Consumer Discretionary)",
    name: "Consumer Discretionary",
    codes: ["XLY", "CONSUMER DISCRETIONARY", "CONSUMER CYCLICAL", "DISCRETIONARY"]
  },
  {
    label: "XLC (Communications)",
    name: "Communication Services",
    codes: ["XLC", "COMMUNICATION SERVICES", "COMMUNICATIONS", "COMM SERVICES", "COMMUNICATION"]
  },
  { label: "XLRE (Real Estate)", name: "Real Estate", codes: ["XLRE", "REAL ESTATE", "REALESTATE"] }
] as const;

function normalizeSectorLabel(value: string) {
  const cleaned = value
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
  const compact = cleaned.replace(/\s+/g, " ");
  const match = stateStreetSectorMeta.find((sector) =>
    sector.codes.some((code) => compact === code || compact.includes(code))
  );
  return match?.label ?? null;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) =>
  keys
    .map((k) => r[k])
    .find((v): v is string => typeof v === "string" && v.trim().length > 0)
    ?.trim() ?? null;
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const parsed = Number(v.replace(/[$,% ,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export type InstitutionalInvestorType = (typeof institutionalInvestorTypes)[number]["value"];
export type InstitutionalPositionChange = (typeof institutionalPositionOrders)[number]["value"];

export type InstitutionalTickerFlowRow = {
  investorType: InstitutionalInvestorType;
  order: string;
  ticker: string;
  value: number | null;
  increasedPositions: number | null;
  decreasedPositions: number | null;
  holdingCount: number | null;
  units: number | null;
  prevUnits: number | null;
  fetchedAt: string;
};

export type InstitutionalSectorExposureRow = {
  investorType: InstitutionalInvestorType;
  sector: string;
  value: number | null;
  reportDate: string;
  fetchedAt: string;
};

export type InstitutionalSummaryPayload = {
  investorTypes: typeof institutionalInvestorTypes;
  positionChanges: typeof institutionalPositionOrders;
  defaultInvestorType: InstitutionalInvestorType;
  defaultPositionChange: InstitutionalPositionChange;
  tickerFlow: InstitutionalTickerFlowRow[];
  sectorExposure: InstitutionalSectorExposureRow[];
  notices: string[];
};

function latestQuarterEndCutoff(now = new Date()) {
  const year = now.getUTCFullYear();
  const quarters = [
    new Date(Date.UTC(year, 2, 31)),
    new Date(Date.UTC(year, 5, 30)),
    new Date(Date.UTC(year, 8, 30)),
    new Date(Date.UTC(year, 11, 31)),
    new Date(Date.UTC(year - 1, 11, 31)),
    new Date(Date.UTC(year - 1, 8, 30)),
    new Date(Date.UTC(year - 1, 5, 30)),
    new Date(Date.UTC(year - 1, 2, 31))
  ]
    .filter((date) => date <= now)
    .sort((a, b) => b.getTime() - a.getTime());
  const keep = quarters.slice(0, SECTOR_EXPOSURE_QUARTERS_RETAINED);
  return keep[keep.length - 1]?.toISOString().slice(0, 10) ?? `${year - 1}-12-31`;
}

function isQuarterEnd(value: string) {
  return /-(03-31|06-30|09-30|12-31)$/.test(value);
}

function normalizeTickerRow(
  raw: unknown,
  investorType: InstitutionalInvestorType,
  order: string,
  fetchedAt: string
): InstitutionalTickerFlowRow | null {
  if (!isRec(raw)) return null;
  const ticker = str(raw, ["ticker", "symbol", "underlying_symbol"]);
  if (!ticker) return null;
  return {
    investorType,
    order,
    ticker: ticker.toUpperCase(),
    value: num(raw.value),
    increasedPositions: num(raw.increased_positions),
    decreasedPositions: num(raw.decreased_positions),
    holdingCount: num(raw.holding_count),
    units: num(raw.units),
    prevUnits: num(raw.prev_units),
    fetchedAt
  };
}

function normalizeSectorRow(
  raw: unknown,
  investorType: InstitutionalInvestorType,
  fetchedAt: string
): InstitutionalSectorExposureRow | null {
  if (!isRec(raw)) return null;
  const sector = str(raw, ["sector", "name"]);
  const reportDate = str(raw, ["report_date", "date"]);
  if (!sector || !reportDate) return null;
  const normalizedSector = normalizeSectorLabel(sector);
  if (!normalizedSector) return null;
  const isoDate = reportDate.slice(0, 10);
  if (!isQuarterEnd(isoDate)) return null;
  return {
    investorType,
    sector: normalizedSector,
    value: num(raw.value),
    reportDate: isoDate,
    fetchedAt
  };
}

function tickerFlowUrl(slug: string, order: string) {
  return `https://phx.unusualwhales.com/api/institutions/ticker-flow/${slug}?order=${order}&limit=10&marketcap_size=null`;
}
function sectorExposureUrl(slug: string) {
  return `https://phx.unusualwhales.com/api/institutions/sector-exposure/${slug}`;
}

function uwHeaders(): Record<string, string> {
  const token = process.env.UNUSUAL_WHALES_API_KEY ?? process.env.UW_API_KEY;
  return token
    ? { accept: "application/json", authorization: `Bearer ${token}` }
    : { accept: "application/json" };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: uwHeaders() });
  if (!res.ok) throw new Error(`Unusual Whales institutional fetch failed: ${res.status}`);
  return res.json();
}

function toTickerDb(row: InstitutionalTickerFlowRow) {
  return {
    investor_type: row.investorType,
    order: row.order,
    ticker: row.ticker,
    value: row.value,
    increased_positions: row.increasedPositions,
    decreased_positions: row.decreasedPositions,
    holding_count: row.holdingCount,
    units: row.units,
    prev_units: row.prevUnits,
    fetched_at: row.fetchedAt,
    updated_at: row.fetchedAt
  };
}
function toSectorDb(row: InstitutionalSectorExposureRow) {
  return {
    investor_type: row.investorType,
    sector: normalizeSectorLabel(row.sector) ?? row.sector,
    value: row.value,
    report_date: row.reportDate,
    fetched_at: row.fetchedAt,
    updated_at: row.fetchedAt
  };
}

export async function refreshInstitutionalData() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return { ok: false as const, error: supabase.message, count: 0, upserted: 0, meta: {} };
  const fetchedAt = new Date().toISOString();
  const tickerRows: InstitutionalTickerFlowRow[] = [];
  const sectorRows: InstitutionalSectorExposureRow[] = [];
  for (const investor of institutionalInvestorTypes) {
    for (const order of [
      TOP_HOLDINGS_ORDER,
      ...institutionalPositionOrders.map((item) => item.order)
    ]) {
      const payload = await fetchJson(tickerFlowUrl(investor.slug, order));
      tickerRows.push(
        ...(extractArrayFromUnusualWhalesResponse(payload)
          .rows.map((row) => normalizeTickerRow(row, investor.value, order, fetchedAt))
          .filter(Boolean) as InstitutionalTickerFlowRow[])
      );
    }
    const sectorPayload = await fetchJson(sectorExposureUrl(investor.slug));
    sectorRows.push(
      ...(extractArrayFromUnusualWhalesResponse(sectorPayload)
        .rows.map((row) => normalizeSectorRow(row, investor.value, fetchedAt))
        .filter(Boolean) as InstitutionalSectorExposureRow[])
    );
  }
  const retainedSectorRows = institutionalInvestorTypes.flatMap((investor) => {
    const investorRows = sectorRows.filter((row) => row.investorType === investor.value);
    const keepDates = Array.from(new Set(investorRows.map((row) => row.reportDate)))
      .sort()
      .reverse()
      .slice(0, SECTOR_EXPOSURE_QUARTERS_RETAINED);
    return investorRows.filter((row) => keepDates.includes(row.reportDate));
  });

  if (tickerRows.length) {
    const { error } = await supabase.client
      .from(SOURCE_TICKER_FLOW)
      .upsert(tickerRows.map(toTickerDb), { onConflict: "investor_type,order,ticker" });
    if (error) throw new Error(`Institutional ticker-flow upsert failed: ${error.message}`);
  }
  if (retainedSectorRows.length) {
    await Promise.all(
      institutionalInvestorTypes.map(async (investor) => {
        const keepDates = Array.from(
          new Set(
            retainedSectorRows
              .filter((row) => row.investorType === investor.value)
              .map((row) => row.reportDate)
          )
        );
        if (!keepDates.length) return;
        await supabase.client
          .from(SOURCE_SECTOR_EXPOSURE)
          .delete()
          .eq("investor_type", investor.value);
      })
    );
    const { error } = await supabase.client
      .from(SOURCE_SECTOR_EXPOSURE)
      .upsert(retainedSectorRows.map(toSectorDb), {
        onConflict: "investor_type,sector,report_date"
      });
    if (error) throw new Error(`Institutional sector exposure upsert failed: ${error.message}`);
  }
  return {
    ok: true as const,
    count: tickerRows.length + sectorRows.length,
    upserted: tickerRows.length + sectorRows.length,
    meta: {
      tickerRows: tickerRows.length,
      sectorRows: retainedSectorRows.length,
      sectorReportDatesRetained: SECTOR_EXPOSURE_QUARTERS_RETAINED
    }
  };
}

function fromTickerDb(row: any): InstitutionalTickerFlowRow {
  return {
    investorType: row.investor_type,
    order: row.order,
    ticker: row.ticker,
    value: row.value == null ? null : Number(row.value),
    increasedPositions: row.increased_positions == null ? null : Number(row.increased_positions),
    decreasedPositions: row.decreased_positions == null ? null : Number(row.decreased_positions),
    holdingCount: row.holding_count == null ? null : Number(row.holding_count),
    units: row.units == null ? null : Number(row.units),
    prevUnits: row.prev_units == null ? null : Number(row.prev_units),
    fetchedAt: row.fetched_at
  };
}
function fromSectorDb(row: any): InstitutionalSectorExposureRow {
  return {
    investorType: row.investor_type,
    sector: normalizeSectorLabel(row.sector) ?? row.sector,
    value: row.value == null ? null : Number(row.value),
    reportDate: row.report_date,
    fetchedAt: row.fetched_at
  };
}

export async function getCachedInstitutionalSummary(): Promise<InstitutionalSummaryPayload> {
  const supabase = createServerSupabaseClient();
  const base = {
    investorTypes: institutionalInvestorTypes,
    positionChanges: institutionalPositionOrders,
    defaultInvestorType: "value" as const,
    defaultPositionChange: "increased" as const
  };
  if (!supabase.ok)
    return { ...base, tickerFlow: [], sectorExposure: [], notices: [supabase.message] };
  const [tickerResult, sectorResult] = await Promise.all([
    supabase.client
      .from(SOURCE_TICKER_FLOW)
      .select(
        "investor_type,order,ticker,value,increased_positions,decreased_positions,holding_count,units,prev_units,fetched_at"
      )
      .order("value", { ascending: false, nullsFirst: false }),
    supabase.client
      .from(SOURCE_SECTOR_EXPOSURE)
      .select("investor_type,sector,value,report_date,fetched_at")
      .order("report_date", { ascending: false })
  ]);
  const notices: string[] = [];
  if (tickerResult.error)
    notices.push(`Institutional ticker-flow cache read failed: ${tickerResult.error.message}`);
  if (sectorResult.error)
    notices.push(`Institutional sector exposure cache read failed: ${sectorResult.error.message}`);
  return {
    ...base,
    tickerFlow: (tickerResult.data ?? []).map(fromTickerDb),
    sectorExposure: (sectorResult.data ?? []).map(fromSectorDb),
    notices
  };
}
