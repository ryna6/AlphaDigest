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

export const trackedInstitutionNames = [
  "BERKSHIRE HATHAWAY INC",
  "DODGE COX",
  "HARRIS ASSOCIATES L P",
  "GATES FOUNDATION TRUST",
  "PZENA INVESTMENT MANAGEMENT LLC",
  "HOTCHKIS WILEY CAPITAL MANAGEMENT LLC",
  "BARROW HANLEY MEWHINNEY STRAUSS LLC",
  "EAGLE CAPITAL MANAGEMENT LLC",
  "ARTISAN PARTNERS LIMITED PARTNERSHIP",
  "GQG PARTNERS LLC",
  "JENNISON ASSOCIATES LLC",
  "T ROWE PRICE INVESTMENT MANAGEMENT INC",
  "SANDS CAPITAL MANAGEMENT LLC",
  "SELECT EQUITY GROUP LP",
  "ALKEON CAPITAL MANAGEMENT LLC",
  "COATUE MANAGEMENT LLC",
  "VIKING GLOBAL INVESTORS LP",
  "LONE PINE CAPITAL LLC",
  "TIGER GLOBAL MANAGEMENT LLC",
  "ADAGE CAPITAL PARTNERS GP LLC"
] as const;

const TRACKED_INFO = "unusual_whales_tracked_institutions";
const TRACKED_HOLDINGS = "unusual_whales_tracked_institution_holdings";
const TRACKED_OPTIONS = "unusual_whales_tracked_institution_options";
const TRACKED_ACTIVITY = "unusual_whales_tracked_institution_activity";
const TRACKED_HISTORY = "unusual_whales_tracked_institution_history";
export const TRACKED_INSTITUTION_HISTORY_QUARTERS_RETAINED = 21;

type TrackedInstitutionInfo = {
  name: string;
  providerName: string;
  slug: string;
  shortName: string | null;
  description: string | null;
  people: unknown;
  totalValue: number | null;
  date: string;
  buyValue: number | null;
  sellValue: number | null;
  spyPrice: number | null;
  fetchedAt: string;
};
type TrackedInstitutionHistory = {
  institutionSlug: string;
  institutionName: string;
  reportDate: string;
  totalValue: number | null;
  spyPrice: number | null;
  fetchedAt: string;
};
type TrackedStockHolding = {
  institutionName: string;
  date: string;
  ticker: string;
  fullName: string | null;
  units: number | null;
  avgPrice: number | null;
  unitsChange: number | null;
  changePerc: number | null;
  percOfShareValue: number | null;
  value: number | null;
  fetchedAt: string;
};
type TrackedOptionHolding = {
  institutionName: string;
  asOfDate: string;
  ticker: string;
  units: number | null;
  fullName: string | null;
  putCall: string | null;
  putOi: number | null;
  callOi: number | null;
  fetchedAt: string;
};
type TrackedActivity = {
  activityId: string;
  institutionName: string;
  ticker: string;
  reportDate: string;
  units: number | null;
  unitsChange: number | null;
  securityType: string | null;
  buyPrice: number | null;
  sellPrice: number | null;
  close: number | null;
  fetchedAt: string;
};

export type TrackedInstitutionPayload = {
  institutions: Array<
    TrackedInstitutionInfo & {
      ytdReturn: number | null;
      oneYearReturn: number | null;
      fiveYearReturn: number | null;
      spyYtdReturn: number | null;
      spyOneYearReturn: number | null;
      spyFiveYearReturn: number | null;
    }
  >;
  holdings: TrackedStockHolding[];
  options: TrackedOptionHolding[];
  activity: TrackedActivity[];
  notices: string[];
};

const normalizeName = (value: string) => value.replace(/[^a-z0-9]/gi, "").toUpperCase();
const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);
const isTrackedQuarterEnd = (value: string | null) =>
  !!value && /-(03-31|06-30|09-30|12-31)$/.test(value);
function latestTrackedQuarterEnd(now = new Date()) {
  const year = now.getUTCFullYear();
  const quarters = [
    new Date(Date.UTC(year, 2, 31)),
    new Date(Date.UTC(year, 5, 30)),
    new Date(Date.UTC(year, 8, 30)),
    new Date(Date.UTC(year, 11, 31)),
    new Date(Date.UTC(year - 1, 11, 31))
  ]
    .filter((date) => date <= now)
    .sort((a, b) => b.getTime() - a.getTime());
  return quarters[0]?.toISOString().slice(0, 10) ?? `${year - 1}-12-31`;
}
const strAny = (r: Rec, keys: string[]) => str(r, keys);
function nestedValue(r: Rec, key: string) {
  return key.split(".").reduce<unknown>((value, part) => {
    if (typeof value === "string" && value.trim().startsWith("{")) {
      try {
        value = JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    if (!isRec(value)) return undefined;
    return value[part];
  }, r);
}
const numAny = (r: Rec, keys: string[]) => {
  for (const k of keys) {
    const v = num(k.includes(".") ? nestedValue(r, k) : r[k]);
    if (v != null) return v;
  }
  return null;
};
function firstArray(payload: unknown) {
  return extractArrayFromUnusualWhalesResponse(payload).rows;
}
function historicalArray(payload: unknown) {
  const rows = firstArray(payload);
  if (rows.length || !isRec(payload)) return rows;
  const nested = isRec(payload.data) ? payload.data : payload;
  for (const key of ["history", "holdings", "institution", "reports", "quarters"]) {
    const value = nested[key];
    if (Array.isArray(value)) return value;
    if (isRec(value)) {
      const nestedRows = firstArray(value);
      if (nestedRows.length) return nestedRows;
    }
  }
  return [];
}
function institutionListUrl(page?: number) {
  return `https://phx.unusualwhales.com/api/institutions?limit=500${page == null ? "" : `&page=${page}`}`;
}
function holdingsUrl(slug: string) {
  return `https://phx.unusualwhales.com/api/institutions/${encodeURIComponent(slug)}/holdings?security_types[]=Share&security_types[]=Fund&page=0&slim=true`;
}
function optionsUrl(slug: string) {
  return `https://phx.unusualwhales.com/api/institutions/${encodeURIComponent(slug)}/holdings?security_types[]=Option&slim=true`;
}
function activityUrl(slug: string) {
  return `https://phx.unusualwhales.com/api/institutions/${encodeURIComponent(slug)}/activity?page=0&limit=50&ticker=`;
}
function historicalUrl(slug: string) {
  return `https://phx.unusualwhales.com/api/institutions/${encodeURIComponent(slug)}`;
}

function resolveTrackedInstitutions(rows: unknown[], fetchedAt: string): TrackedInstitutionInfo[] {
  const recs = rows.filter(isRec);
  return trackedInstitutionNames.flatMap((target) => {
    const match =
      recs.find((r) =>
        ["name", "institution_name", "full_name", "short_name"].some(
          (k) => typeof r[k] === "string" && normalizeName(String(r[k])) === normalizeName(target)
        )
      ) ??
      recs.find((r) =>
        ["name", "institution_name", "full_name", "short_name"].some(
          (k) =>
            typeof r[k] === "string" && normalizeName(String(r[k])).includes(normalizeName(target))
        )
      );
    if (!match) return [];
    const providerName = strAny(match, ["name", "institution_name", "full_name"]) ?? target;
    const slug = strAny(match, ["slug", "name", "institution_name", "full_name"]) ?? providerName;
    const resolvedDate = dateOnly(
      strAny(match, ["date", "report_date", "filing_date", "period_of_report"])
    );
    const date = isTrackedQuarterEnd(resolvedDate)
      ? (resolvedDate ?? latestTrackedQuarterEnd())
      : latestTrackedQuarterEnd();
    return [
      {
        name: target,
        providerName,
        slug,
        shortName: strAny(match, ["short_name"]),
        description: strAny(match, ["description"]),
        people: match.people ?? null,
        totalValue: numAny(match, ["total_value", "value", "market_value"]),
        date,
        buyValue: numAny(match, ["buy_value"]),
        sellValue: numAny(match, ["sell_value"]),
        spyPrice: numAny(match, ["spy_price"]),
        fetchedAt
      }
    ];
  });
}
function normalizeHistoricalInfo(
  raw: unknown,
  base: TrackedInstitutionInfo,
  fetchedAt: string
): TrackedInstitutionHistory | null {
  if (!isRec(raw)) return null;
  const reportDate = dateOnly(
    strAny(raw, ["report_date", "date", "period_of_report", "filing_date"])
  );
  if (!reportDate || !isTrackedQuarterEnd(reportDate)) return null;
  return {
    institutionSlug: base.slug,
    institutionName: base.name,
    reportDate,
    totalValue: numAny(raw, ["total_value", "value", "market_value"]),
    spyPrice: numAny(raw, ["spy_price"]),
    fetchedAt
  };
}

function normalizeHolding(
  raw: unknown,
  institutionName: string,
  fallbackDate: string,
  fetchedAt: string
): TrackedStockHolding | null {
  if (!isRec(raw)) return null;
  const ticker = strAny(raw, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
  if (!ticker) return null;
  return {
    institutionName,
    date: dateOnly(strAny(raw, ["date", "report_date"])) ?? fallbackDate,
    ticker,
    fullName: strAny(raw, ["full_name", "name"]),
    units: numAny(raw, ["units", "shares"]),
    avgPrice: numAny(raw, ["avg_price", "average_price"]),
    unitsChange: numAny(raw, ["units_change", "change"]),
    changePerc: numAny(raw, ["change_perc", "change_pct", "percentage_change"]),
    percOfShareValue: numAny(raw, [
      "perc_of_share_value",
      "portfolio_weight",
      "percent_of_portfolio"
    ]),
    value: numAny(raw, ["value", "market_value"]),
    fetchedAt
  };
}
function normalizeOption(
  raw: unknown,
  institutionName: string,
  fallbackDate: string,
  fetchedAt: string
): TrackedOptionHolding | null {
  if (!isRec(raw)) return null;
  const ticker = strAny(raw, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
  if (!ticker) return null;
  return {
    institutionName,
    asOfDate: dateOnly(strAny(raw, ["as_of_date", "date", "report_date"])) ?? fallbackDate,
    ticker,
    units: numAny(raw, ["units", "contracts"]),
    fullName: strAny(raw, ["full_name", "name"]),
    putCall: strAny(raw, ["put_call", "type", "option_type"]),
    putOi: numAny(raw, ["oi.put_oi", "put_oi", "put_open_interest"]),
    callOi: numAny(raw, ["oi.call_oi", "call_oi", "call_open_interest"]),
    fetchedAt
  };
}
function activityId(institutionName: string, ticker: string, reportDate: string, securityType: string | null) {
  return [institutionName, ticker, reportDate, securityType ?? ""].join("|");
}
function normalizeActivity(
  raw: unknown,
  institutionName: string,
  fetchedAt: string
): TrackedActivity | null {
  if (!isRec(raw)) return null;
  const ticker = strAny(raw, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
  const reportDate = dateOnly(strAny(raw, ["report_date", "date"]));
  if (!ticker || !reportDate) return null;
  const securityType = strAny(raw, ["security_type", "type"]);
  return {
    activityId: activityId(institutionName, ticker, reportDate, securityType),
    institutionName,
    ticker,
    reportDate,
    units: numAny(raw, ["units", "shares"]),
    unitsChange: numAny(raw, ["units_change", "change"]),
    securityType,
    buyPrice: numAny(raw, ["buy_price"]),
    sellPrice: numAny(raw, ["sell_price"]),
    close: numAny(raw, ["close", "price"]),
    fetchedAt
  };
}

async function upsertTrackedInstitutionData() {
  const fetchedAt = new Date().toISOString();
  const listRows = [
    ...firstArray(await fetchJson(institutionListUrl())),
    ...firstArray(await fetchJson(institutionListUrl(1)))
  ];
  const baseInstitutions = resolveTrackedInstitutions(listRows, fetchedAt);
  const institutions = [...baseInstitutions];
  const history: TrackedInstitutionHistory[] = [];
  const holdings: TrackedStockHolding[] = [],
    options: TrackedOptionHolding[] = [],
    activity: TrackedActivity[] = [];
  const activityDiagnostics: Array<Record<string, unknown>> = [];
  for (const inst of baseInstitutions) {
    const slug = inst.providerName || inst.slug;
    const [h, o, a, hist] = await Promise.all([
      fetchJson(holdingsUrl(slug)),
      fetchJson(optionsUrl(slug)),
      fetchJson(activityUrl(slug)),
      fetchJson(historicalUrl(slug))
    ]);
    const historicalInfos = historicalArray(hist)
      .map((r) => normalizeHistoricalInfo(r, inst, fetchedAt))
      .filter(Boolean) as TrackedInstitutionHistory[];
    if (historicalInfos.length) history.push(...historicalInfos);
    holdings.push(
      ...(firstArray(h)
        .map((r) => normalizeHolding(r, inst.name, inst.date, fetchedAt))
        .filter(Boolean) as TrackedStockHolding[])
    );
    options.push(
      ...(firstArray(o)
        .map((r) => normalizeOption(r, inst.name, inst.date, fetchedAt))
        .filter(Boolean) as TrackedOptionHolding[])
    );
    const activityExtracted = isRec(a) && Array.isArray(a.data)
      ? { rows: a.data, path: "data" }
      : extractArrayFromUnusualWhalesResponse(a);
    let skippedMissingTicker = 0;
    let skippedMissingReportDate = 0;
    let skippedInvalid = 0;
    const normalizedActivity = activityExtracted.rows
      .map((r) => {
        if (!isRec(r)) {
          skippedInvalid++;
          return null;
        }
        const ticker = strAny(r, ["ticker", "symbol", "underlying_symbol"])?.toUpperCase();
        const reportDate = dateOnly(strAny(r, ["report_date", "date"]));
        if (!ticker) skippedMissingTicker++;
        if (!reportDate) skippedMissingReportDate++;
        return normalizeActivity(r, inst.name, fetchedAt);
      })
      .filter(Boolean) as TrackedActivity[];
    activity.push(...normalizedActivity);
    activityDiagnostics.push({
      institution: inst.name,
      slug,
      responsePath: activityExtracted.path,
      fetchedRows: activityExtracted.rows.length,
      normalizedRows: normalizedActivity.length,
      skippedRows: activityExtracted.rows.length - normalizedActivity.length,
      skippedReasons: {
        invalidRow: skippedInvalid,
        missingTicker: skippedMissingTicker,
        missingReportDate: skippedMissingReportDate
      }
    });
  }
  const dedupedActivity = Array.from(new Map(activity.map((row) => [row.activityId, row])).values());
  return { institutions, history, holdings, options, activity: dedupedActivity, activityDiagnostics };
}

async function persistTrackedData(
  client: any,
  data: Awaited<ReturnType<typeof upsertTrackedInstitutionData>>
) {
  if (data.institutions.length) {
    const { error } = await client.from(TRACKED_INFO).upsert(
      data.institutions.map((r) => ({
        institution_name: r.name,
        provider_name: r.providerName,
        slug: r.slug,
        short_name: r.shortName,
        description: r.description,
        people: r.people,
        total_value: r.totalValue,
        report_date: r.date,
        buy_value: r.buyValue,
        sell_value: r.sellValue,
        fetched_at: r.fetchedAt,
        updated_at: r.fetchedAt
      })),
      { onConflict: "institution_name,report_date" }
    );
    if (error) throw new Error(`Tracked institution info upsert failed: ${error.message}`);
    await Promise.all(
      data.institutions.map((inst) =>
        client
          .from(TRACKED_INFO)
          .delete()
          .eq("institution_name", inst.name)
          .neq("report_date", inst.date)
      )
    );
  }
  if (data.history.length) {
    const { error } = await client.from(TRACKED_HISTORY).upsert(
      data.history.map((r) => ({
        institution_slug: r.institutionSlug,
        institution_name: r.institutionName,
        report_date: r.reportDate,
        total_value: r.totalValue,
        spy_price: r.spyPrice,
        fetched_at: r.fetchedAt,
        updated_at: r.fetchedAt
      })),
      { onConflict: "institution_slug,report_date" }
    );
    if (error) throw new Error(`Tracked institution history upsert failed: ${error.message}`);
    for (const inst of trackedInstitutionNames) {
      const { data: keep } = await client
        .from(TRACKED_HISTORY)
        .select("report_date")
        .eq("institution_name", inst)
        .order("report_date", { ascending: false })
        .limit(TRACKED_INSTITUTION_HISTORY_QUARTERS_RETAINED);
      const keepDates = (keep ?? []).map((r: any) => r.report_date);
      if (keepDates.length)
        await client
          .from(TRACKED_HISTORY)
          .delete()
          .eq("institution_name", inst)
          .not("report_date", "in", `(${keepDates.join(",")})`);
    }
  }
  if (data.holdings.length) {
    const { error } = await client.from(TRACKED_HOLDINGS).upsert(
      data.holdings.map((r) => ({
        institution_name: r.institutionName,
        report_date: r.date,
        ticker: r.ticker,
        full_name: r.fullName,
        units: r.units,
        avg_price: r.avgPrice,
        units_change: r.unitsChange,
        change_perc: r.changePerc,
        perc_of_share_value: r.percOfShareValue,
        value: r.value,
        fetched_at: r.fetchedAt,
        updated_at: r.fetchedAt
      })),
      { onConflict: "institution_name,report_date,ticker" }
    );
    if (error) throw new Error(`Tracked institution holdings upsert failed: ${error.message}`);
  }
  if (data.options.length) {
    const { error } = await client.from(TRACKED_OPTIONS).upsert(
      data.options.map((r) => ({
        institution_name: r.institutionName,
        as_of_date: r.asOfDate,
        ticker: r.ticker,
        units: r.units,
        full_name: r.fullName,
        put_call: r.putCall ?? "Unknown",
        put_oi: r.putOi,
        call_oi: r.callOi,
        fetched_at: r.fetchedAt,
        updated_at: r.fetchedAt
      })),
      { onConflict: "institution_name,as_of_date,ticker,put_call" }
    );
    if (error) throw new Error(`Tracked institution options upsert failed: ${error.message}`);
  }
  if (data.activity.length) {
    const { error } = await client.from(TRACKED_ACTIVITY).upsert(
      data.activity.map((r) => ({
        activity_id: r.activityId,
        institution_name: r.institutionName,
        ticker: r.ticker,
        report_date: r.reportDate,
        units: r.units,
        units_change: r.unitsChange,
        security_type: r.securityType,
        buy_price: r.buyPrice,
        sell_price: r.sellPrice,
        close: r.close,
        fetched_at: r.fetchedAt,
        updated_at: r.fetchedAt
      })),
      { onConflict: "activity_id" }
    );
    if (error) throw new Error(`Tracked institution activity upsert failed: ${error.message}`);
  }
  for (const diagnostic of data.activityDiagnostics) {
    console.info("tracked_institution_activity_refresh", {
      ...diagnostic,
      upsertedRows: data.activity.filter((row) => row.institutionName === diagnostic.institution)
        .length
    });
  }
}

function pctReturn(
  rows: TrackedInstitutionHistory[],
  latest: TrackedInstitutionHistory,
  targetDate: Date,
  field: "totalValue" | "spyPrice" = "totalValue"
) {
  const latestValue = latest[field];
  if (latestValue == null) return null;
  const baseline = rows
    .filter((r) => r[field] != null && new Date(`${r.reportDate}T00:00:00Z`) <= targetDate)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
  const baselineValue = baseline?.[field];
  return baselineValue ? ((latestValue - baselineValue) / baselineValue) * 100 : null;
}
function withReturns(institutions: TrackedInstitutionInfo[], history: TrackedInstitutionHistory[]) {
  return trackedInstitutionNames.flatMap((name) => {
    const latestInfo = institutions
      .filter((r) => r.name === name)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latestInfo) return [];
    const rows = history
      .filter((r) => r.institutionName === name)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    const latest = rows[0];
    if (!latest)
      return [
        {
          ...latestInfo,
          ytdReturn: null,
          oneYearReturn: null,
          fiveYearReturn: null,
          spyYtdReturn: null,
          spyOneYearReturn: null,
          spyFiveYearReturn: null
        }
      ];
    const d = new Date(`${latest.reportDate}T00:00:00Z`);
    return [
      {
        ...latestInfo,
        totalValue: latest.totalValue ?? latestInfo.totalValue,
        spyPrice: latest.spyPrice,
        date: latest.reportDate,
        ytdReturn: pctReturn(rows, latest, new Date(Date.UTC(d.getUTCFullYear() - 1, 11, 31))),
        oneYearReturn: pctReturn(
          rows,
          latest,
          new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()))
        ),
        fiveYearReturn: pctReturn(
          rows,
          latest,
          new Date(Date.UTC(d.getUTCFullYear() - 5, d.getUTCMonth(), d.getUTCDate()))
        ),
        spyYtdReturn: pctReturn(
          rows,
          latest,
          new Date(Date.UTC(d.getUTCFullYear() - 1, 11, 31)),
          "spyPrice"
        ),
        spyOneYearReturn: pctReturn(
          rows,
          latest,
          new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate())),
          "spyPrice"
        ),
        spyFiveYearReturn: pctReturn(
          rows,
          latest,
          new Date(Date.UTC(d.getUTCFullYear() - 5, d.getUTCMonth(), d.getUTCDate())),
          "spyPrice"
        )
      }
    ];
  });
}

export async function getCachedTrackedInstitutions(): Promise<TrackedInstitutionPayload> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return {
      institutions: [],
      holdings: [],
      options: [],
      activity: [],
      notices: [supabase.message]
    };
  const [info, historyResult, holdings, options, activity] = await Promise.all([
    supabase.client
      .from(TRACKED_INFO)
      .select(
        "institution_name,provider_name,slug,short_name,description,people,total_value,report_date,buy_value,sell_value,fetched_at"
      )
      .order("report_date", { ascending: false }),
    supabase.client
      .from(TRACKED_HISTORY)
      .select("institution_slug,institution_name,report_date,total_value,spy_price,fetched_at")
      .order("report_date", { ascending: false }),
    supabase.client
      .from(TRACKED_HOLDINGS)
      .select(
        "institution_name,report_date,ticker,full_name,units,avg_price,units_change,change_perc,perc_of_share_value,value,fetched_at"
      )
      .order("value", { ascending: false, nullsFirst: false }),
    supabase.client
      .from(TRACKED_OPTIONS)
      .select(
        "institution_name,as_of_date,ticker,units,full_name,put_call,put_oi,call_oi,fetched_at"
      )
      .order("units", { ascending: false, nullsFirst: false }),
    supabase.client
      .from(TRACKED_ACTIVITY)
      .select(
        "activity_id,institution_name,ticker,report_date,units,units_change,security_type,buy_price,sell_price,close,fetched_at"
      )
      .order("report_date", { ascending: false })
  ]);
  const notices: string[] = [];
  for (const [label, result] of [
    ["info", info],
    ["history", historyResult],
    ["holdings", holdings],
    ["options", options],
    ["activity", activity]
  ] as const)
    if (result.error)
      notices.push(`Tracked institution ${label} cache read failed: ${result.error.message}`);
  const infos = (info.data ?? []).map((r: any) => ({
    name: r.institution_name,
    providerName: r.provider_name,
    slug: r.slug,
    shortName: r.short_name,
    description: r.description,
    people: r.people,
    totalValue: r.total_value == null ? null : Number(r.total_value),
    date: r.report_date,
    buyValue: r.buy_value == null ? null : Number(r.buy_value),
    sellValue: r.sell_value == null ? null : Number(r.sell_value),
    spyPrice: null,
    fetchedAt: r.fetched_at
  }));
  const histories = (historyResult.data ?? []).map((r: any) => ({
    institutionSlug: r.institution_slug,
    institutionName: r.institution_name,
    reportDate: r.report_date,
    totalValue: r.total_value == null ? null : Number(r.total_value),
    spyPrice: r.spy_price == null ? null : Number(r.spy_price),
    fetchedAt: r.fetched_at
  }));
  return {
    institutions: withReturns(infos, histories),
    holdings: (holdings.data ?? []).map((r: any) => ({
      institutionName: r.institution_name,
      date: r.report_date,
      ticker: r.ticker,
      fullName: r.full_name,
      units: r.units == null ? null : Number(r.units),
      avgPrice: r.avg_price == null ? null : Number(r.avg_price),
      unitsChange: r.units_change == null ? null : Number(r.units_change),
      changePerc: r.change_perc == null ? null : Number(r.change_perc),
      percOfShareValue: r.perc_of_share_value == null ? null : Number(r.perc_of_share_value),
      value: r.value == null ? null : Number(r.value),
      fetchedAt: r.fetched_at
    })),
    options: (options.data ?? []).map((r: any) => ({
      institutionName: r.institution_name,
      asOfDate: r.as_of_date,
      ticker: r.ticker,
      units: r.units == null ? null : Number(r.units),
      fullName: r.full_name,
      putCall: r.put_call,
      putOi: r.put_oi == null ? null : Number(r.put_oi),
      callOi: r.call_oi == null ? null : Number(r.call_oi),
      fetchedAt: r.fetched_at
    })),
    activity: (activity.data ?? []).map((r: any) => ({
      activityId: r.activity_id,
      institutionName: r.institution_name,
      ticker: r.ticker,
      reportDate: r.report_date,
      units: r.units == null ? null : Number(r.units),
      unitsChange: r.units_change == null ? null : Number(r.units_change),
      securityType: r.security_type,
      buyPrice: r.buy_price == null ? null : Number(r.buy_price),
      sellPrice: r.sell_price == null ? null : Number(r.sell_price),
      close: r.close == null ? null : Number(r.close),
      fetchedAt: r.fetched_at
    })),
    notices
  };
}

export async function refreshTrackedInstitutionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return { ok: false as const, error: supabase.message, count: 0, upserted: 0, meta: {} };
  const trackedData = await upsertTrackedInstitutionData();
  await persistTrackedData(supabase.client, trackedData);
  return {
    ok: true as const,
    count:
      trackedData.institutions.length +
      trackedData.history.length +
      trackedData.holdings.length +
      trackedData.options.length +
      trackedData.activity.length,
    upserted:
      trackedData.institutions.length +
      trackedData.history.length +
      trackedData.holdings.length +
      trackedData.options.length +
      trackedData.activity.length,
    meta: {
      trackedInstitutions: trackedData.institutions.length,
      trackedHistory: trackedData.history.length,
      trackedHistoryQuartersRetained: TRACKED_INSTITUTION_HISTORY_QUARTERS_RETAINED,
      trackedHoldings: trackedData.holdings.length,
      trackedOptions: trackedData.options.length,
      trackedActivity: trackedData.activity.length,
      trackedActivityDiagnostics: trackedData.activityDiagnostics
    }
  };
}

export async function refreshInstitutionalSummaryData() {
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
      sectorReportDatesRetained: SECTOR_EXPOSURE_QUARTERS_RETAINED,
      summaryOnly: true
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
