import { createServerSupabaseClient } from "@/lib/db/supabase";
import { fetchYahooYtdReturn } from "./yahoo-finance";

const PORTFOLIOS_TABLE = "unusual_whales_congressional_portfolios";
const TRADES_TABLE = "unusual_whales_congressional_trades";
const LIST_URL = "https://phx.unusualwhales.com/api/portfolios_v2";
const PROFILE_BASE_URL = "https://phx.unusualwhales.com/api/senate_stocks";
const MAX_DUPLICATE_NAMES_TO_LOG = 10;
const DISALLOWED_TRADE_ASSETS = new Set(["bond", "corporate bond", "municipal-security", "other"]);
const TRADE_RETENTION_MONTHS = 24;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) =>
  keys
    .map((k) => r[k])
    .find((v): v is string => typeof v === "string" && v.trim().length > 0)
    ?.trim() ?? null;
const dateStr = (r: Rec, keys: string[]) => {
  const value = str(r, keys);
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) return null;
  const parsed = new Date(`${match[0]}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? match[0] : null;
};
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const parsed = Number(v.replace(/[%,+ ]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const slug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const CONGRESSIONAL_BLACKLIST_NAMES = [
  "William Harnisch",
  "Donald McEachin",
  "Ray Dalio"
] as const;
const CONGRESSIONAL_BLACKLIST_KEYS = new Set(CONGRESSIONAL_BLACKLIST_NAMES.map(slug));
const skipKey = (reason: string) =>
  reason
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

const uniqueStrings = (values: Array<string | undefined>) => [
  ...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value))
];

function headers(): Record<string, string> {
  return { accept: "application/json" };
}

export function congressionalProfileUrl(politicianName: string) {
  return `${PROFILE_BASE_URL}/${encodeURIComponent(politicianName)}?limit=500`;
}

export type CongressionalTrade = {
  politicianName: string;
  symbol: string | null;
  transactionDate: string | null;
  asset: string | null;
  amounts: string | null;
  txnType: string | null;
};

export type CongressionalPortfolio = {
  name: string;
  politicianKey: string;
  ytdReturn: number | null;
  rank: number;
  fetchedAt: string;
  fullName: string | null;
  currentChamber: string | null;
  currentParty: string | null;
  currentDistrict: string | null;
  bio: string | null;
  ids?: string[];
  trades?: CongressionalTrade[];
};

function normalizeListRow(raw: unknown): {
  row: Omit<
    CongressionalPortfolio,
    | "rank"
    | "fetchedAt"
    | "fullName"
    | "currentChamber"
    | "currentParty"
    | "currentDistrict"
    | "bio"
    | "trades"
  > | null;
  skipReason?: string;
} {
  if (!isRec(raw)) return { row: null, skipReason: "invalid_list_row" };
  const name = str(raw, ["name"]);
  if (!name) return { row: null, skipReason: "missing_name" };
  const ytdReturn = num(raw.ytd_return);
  if (ytdReturn === null) return { row: null, skipReason: "missing_or_non_numeric_ytd_return" };
  const ids = Array.isArray(raw.ids)
    ? raw.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : undefined;
  return {
    row: { name, politicianKey: slug(name), ytdReturn, ids: ids?.length ? ids : undefined }
  };
}

function mergeIds(a?: string[], b?: string[]) {
  const merged = uniqueStrings([...(a ?? []), ...(b ?? [])]);
  return merged.length ? merged : undefined;
}

export function selectTopCongressionalPortfolioRows(rawRows: unknown[], fetchedAt: string) {
  const skippedRows: Record<string, number> = {};
  const skip = (reason: string, amount = 1) => {
    const key = skipKey(reason);
    skippedRows[key] = (skippedRows[key] ?? 0) + amount;
  };
  const normalizedRows = rawRows.flatMap((raw) => {
    const { row, skipReason } = normalizeListRow(raw);
    if (!row) {
      skip(skipReason ?? "invalid_list_row");
      return [];
    }
    return [row];
  });
  const blacklistFilteredRows = normalizedRows.filter((row) => {
    if (!CONGRESSIONAL_BLACKLIST_KEYS.has(row.politicianKey)) return true;
    skip("blacklisted_congressional_politician");
    return false;
  });
  const duplicateNames = new Set<string>();
  const dedupedByKey = new Map<string, (typeof blacklistFilteredRows)[number]>();
  for (const row of blacklistFilteredRows) {
    const existing = dedupedByKey.get(row.politicianKey);
    if (!existing) {
      dedupedByKey.set(row.politicianKey, row);
      continue;
    }
    duplicateNames.add(row.name);
    const selected =
      (row.ytdReturn ?? -Infinity) > (existing.ytdReturn ?? -Infinity) ? row : existing;
    dedupedByKey.set(row.politicianKey, {
      ...selected,
      ids: mergeIds(existing.ids, row.ids)
    });
  }
  const dedupedRows = [...dedupedByKey.values()];
  const rows = dedupedRows
    .sort((a, b) => (b.ytdReturn ?? -Infinity) - (a.ytdReturn ?? -Infinity))
    .slice(0, 20)
    .map((r, index) => ({ ...r, rank: index + 1, fetchedAt }));
  return {
    rows,
    skippedRows,
    normalizedListRowCount: normalizedRows.length,
    blacklistedRowCount: normalizedRows.length - blacklistFilteredRows.length,
    duplicateRowCount: blacklistFilteredRows.length - dedupedRows.length,
    dedupedRowCount: dedupedRows.length,
    selectedTop20RowCount: rows.length,
    duplicateNames: [...duplicateNames].slice(0, MAX_DUPLICATE_NAMES_TO_LOG)
  };
}

function keysOf(value: unknown) {
  return isRec(value) ? Object.keys(value).sort() : [];
}

function listRows(payload: unknown): { rows: unknown[]; path: string } {
  if (!isRec(payload)) return { rows: [], path: "none" };
  if (Array.isArray(payload.etfs)) return { rows: payload.etfs, path: "etfs" };
  return { rows: [], path: "none" };
}

function extractTradeRows(payload: unknown): {
  rows: unknown[];
  path: string;
  containerKeys: Record<string, string[]>;
} {
  const containerKeys: Record<string, string[]> = {};
  if (!isRec(payload)) return { rows: [], path: "none", containerKeys };
  for (const key of ["politician", "companies", "data"]) {
    if (isRec(payload[key])) containerKeys[key] = keysOf(payload[key]);
  }
  if (Array.isArray(payload.senate_stocks))
    return { rows: payload.senate_stocks, path: "senate_stocks", containerKeys };
  if (Array.isArray(payload.transactions))
    return { rows: payload.transactions, path: "transactions", containerKeys };
  if (Array.isArray(payload.trades)) return { rows: payload.trades, path: "trades", containerKeys };
  if (Array.isArray(payload.data)) return { rows: payload.data, path: "data", containerKeys };
  if (isRec(payload.data) && Array.isArray(payload.data.senate_stocks))
    return { rows: payload.data.senate_stocks, path: "data.senate_stocks", containerKeys };
  if (isRec(payload.data) && Array.isArray(payload.data.transactions))
    return { rows: payload.data.transactions, path: "data.transactions", containerKeys };
  return { rows: [], path: "none", containerKeys };
}

function normalizeProfile(payload: unknown) {
  const root = isRec(payload) ? payload : {};
  const data = isRec(root.data) ? root.data : null;
  const profile = isRec(root.politician)
    ? root.politician
    : data && isRec(data.politician)
      ? data.politician
      : isRec(root.profile)
        ? root.profile
        : data && isRec(data.profile)
          ? data.profile
          : (data ?? root);
  return {
    fullName: str(profile, ["full_name", "name"]),
    currentChamber: str(profile, ["current_chamber", "chamber"]),
    currentParty: str(profile, ["current_party", "party"]),
    currentDistrict: str(profile, ["current_district", "district"]),
    bio: str(profile, ["bio", "biography"])
  };
}

function retentionCutoffDate(referenceIso: string) {
  const date = new Date(referenceIso);
  date.setUTCMonth(date.getUTCMonth() - TRADE_RETENTION_MONTHS);
  return date.toISOString().slice(0, 10);
}

function normalizeAsset(value: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

function normalizeTrade(
  raw: unknown,
  politicianName: string,
  cutoffDate: string
): { trade: CongressionalTrade | null; skipReason?: string } {
  if (!isRec(raw)) return { trade: null, skipReason: "invalid_trade_row" };
  const asset = str(raw, ["asset", "assets", "asset_type"]);
  const normalizedAsset = normalizeAsset(asset);
  if (normalizedAsset && DISALLOWED_TRADE_ASSETS.has(normalizedAsset)) {
    return { trade: null, skipReason: "disallowed_trade_asset_type" };
  }
  const transactionDate = dateStr(raw, ["transaction_date", "traded_date"]);
  if (transactionDate && transactionDate < cutoffDate) {
    return { trade: null, skipReason: "trade_older_than_24_months" };
  }
  return {
    trade: {
      politicianName,
      symbol: str(raw, ["symbol", "ticker"]),
      transactionDate,
      asset,
      amounts: str(raw, ["amounts", "amount"]),
      txnType: str(raw, ["txn_type", "transaction_type", "type"])
    }
  };
}

export async function refreshCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return { ok: false as const, error: supabase.message, count: 0, upserted: 0, meta: {} };
  const fetchedAt = new Date().toISOString();
  const tradeRetentionCutoffDate = retentionCutoffDate(fetchedAt);
  const diagnostics = {
    listFetchStatus: null as number | null,
    rawListRowCount: 0,
    normalizedListRowCount: 0,
    blacklistedRowCount: 0,
    duplicateRowCount: 0,
    dedupedRowCount: 0,
    selectedTop20RowCount: 0,
    portfolioRowsUpserted: 0,
    tradeRowsUpserted: 0,
    duplicateNames: [] as string[],
    listTopLevelKeys: [] as string[],
    detectedListRowPath: "none",
    skippedRows: {} as Record<string, number>,
    tradeRetentionCutoffDate,
    disallowedTradeAssetTypes: [...DISALLOWED_TRADE_ASSETS],
    warnings: [] as string[],
    profiles: [] as Array<{
      politician: string;
      profileFetchStatus: number | null;
      profileUrl?: string;
      profileTopLevelKeys?: string[];
      detectedTradePath?: string;
      tradeRowCount: number;
      tradeRowsUpserted: number;
      error?: string;
    }>
  };
  const skip = (reason: string, amount = 1) => {
    const key = skipKey(reason);
    diagnostics.skippedRows[key] = (diagnostics.skippedRows[key] ?? 0) + amount;
  };

  const blacklistKeys = [...CONGRESSIONAL_BLACKLIST_KEYS];
  for (const table of [PORTFOLIOS_TABLE, TRADES_TABLE]) {
    const prune = await supabase.client.from(table).delete().in("politician_key", blacklistKeys);
    if (prune.error)
      diagnostics.warnings.push(
        `congressional_blacklist_prune_failed:${table}:${prune.error.message}`
      );
  }
  for (const disallowedAsset of DISALLOWED_TRADE_ASSETS) {
    const disallowedPrune = await supabase.client
      .from(TRADES_TABLE)
      .delete()
      .ilike("asset", disallowedAsset);
    if (disallowedPrune.error)
      diagnostics.warnings.push(
        `congressional_disallowed_asset_prune_failed:${disallowedAsset}:${disallowedPrune.error.message}`
      );
  }
  const retentionPrune = await supabase.client
    .from(TRADES_TABLE)
    .delete()
    .lt("transaction_date", tradeRetentionCutoffDate);
  if (retentionPrune.error)
    diagnostics.warnings.push(
      `congressional_trade_retention_prune_failed:${retentionPrune.error.message}`
    );

  const response = await fetch(LIST_URL, { headers: headers(), cache: "no-store" });
  diagnostics.listFetchStatus = response.status;
  console.info("congressional_list_fetch", { status: response.status, ok: response.ok });
  if (!response.ok) {
    const error = `Unusual Whales congressional portfolios fetch failed: ${response.status}`;
    console.warn("congressional_refresh_failed", { stage: "list_fetch", status: response.status });
    return { ok: false as const, error, count: 0, upserted: 0, meta: diagnostics };
  }

  const payload = await response.json();
  diagnostics.listTopLevelKeys = keysOf(payload);
  const listExtraction = listRows(payload);
  diagnostics.detectedListRowPath = listExtraction.path;
  const rawRows = listExtraction.rows;
  diagnostics.rawListRowCount = rawRows.length;
  if (listExtraction.path !== "etfs") {
    const error = "Unusual Whales congressional portfolios response did not include json.etfs rows";
    console.warn("congressional_refresh_failed", {
      stage: "list_parse",
      topLevelKeys: diagnostics.listTopLevelKeys,
      detectedRowPath: diagnostics.detectedListRowPath
    });
    return { ok: false as const, error, count: 0, upserted: 0, meta: diagnostics };
  }
  const selection = selectTopCongressionalPortfolioRows(rawRows, fetchedAt);
  for (const [reason, amount] of Object.entries(selection.skippedRows)) skip(reason, amount);
  diagnostics.normalizedListRowCount = selection.normalizedListRowCount;
  diagnostics.blacklistedRowCount = selection.blacklistedRowCount;
  diagnostics.duplicateRowCount = selection.duplicateRowCount;
  diagnostics.dedupedRowCount = selection.dedupedRowCount;
  diagnostics.selectedTop20RowCount = selection.selectedTop20RowCount;
  diagnostics.duplicateNames = selection.duplicateNames;
  const rows = selection.rows;
  console.info("congressional_list_normalized", {
    topLevelKeys: diagnostics.listTopLevelKeys,
    detectedRowPath: diagnostics.detectedListRowPath,
    rawListRowCount: diagnostics.rawListRowCount,
    normalizedListRowCount: diagnostics.normalizedListRowCount,
    blacklistedRows: diagnostics.blacklistedRowCount,
    duplicateRowCount: diagnostics.duplicateRowCount,
    dedupedRowCount: diagnostics.dedupedRowCount,
    selectedTop20RowCount: diagnostics.selectedTop20RowCount,
    duplicateNames: diagnostics.duplicateNames,
    skippedRows: diagnostics.skippedRows,
    warnings: diagnostics.warnings
  });
  if (rows.length < 20) {
    diagnostics.warnings.push(`congressional_less_than_20_valid_unique_rows:${rows.length}`);
    console.warn("congressional_less_than_20_valid_unique_rows", {
      selectedTop20RowCount: rows.length,
      rawListRowCount: diagnostics.rawListRowCount,
      normalizedListRowCount: diagnostics.normalizedListRowCount,
      blacklistedRows: diagnostics.blacklistedRowCount,
      dedupedRowCount: diagnostics.dedupedRowCount
    });
  }

  let tradesUpserted = 0;
  const portfolioRows = [];
  for (const row of rows) {
    let profile = {
      fullName: null as string | null,
      currentChamber: null as string | null,
      currentParty: null as string | null,
      currentDistrict: null as string | null,
      bio: null as string | null
    };
    let profileFetchStatus: number | null = null;
    let tradeRowsUpserted = 0;
    let tradeRowCount = 0;
    try {
      const profileUrl = congressionalProfileUrl(row.name);
      const profileResponse = await fetch(profileUrl, { headers: headers(), cache: "no-store" });
      profileFetchStatus = profileResponse.status;
      console.info("congressional_profile_fetch", {
        politician: row.name,
        profileUrl,
        status: profileResponse.status,
        ok: profileResponse.ok
      });
      if (!profileResponse.ok) throw new Error(`status ${profileResponse.status}`);
      const profilePayload = await profileResponse.json();
      profile = normalizeProfile(profilePayload);
      const profileTopLevelKeys = keysOf(profilePayload);
      const tradeExtraction = extractTradeRows(profilePayload);
      console.info("congressional_profile_shape", {
        politician: row.name,
        topLevelKeys: profileTopLevelKeys,
        detectedTradePath: tradeExtraction.path,
        tradeRowCount: tradeExtraction.rows.length
      });
      if (!tradeExtraction.rows.length) {
        const warning = "congressional_no_trade_rows_found";
        diagnostics.warnings.push(`${warning}:${row.politicianKey}`);
        console.warn(warning, {
          politician: row.name,
          topLevelKeys: profileTopLevelKeys,
          firstLevelContainerKeys: tradeExtraction.containerKeys,
          detectedTradePath: tradeExtraction.path
        });
      }
      const tradeRows = tradeExtraction.rows.flatMap((raw) => {
        const { trade, skipReason } = normalizeTrade(raw, row.name, tradeRetentionCutoffDate);
        if (!trade) {
          skip(skipReason ?? "invalid_trade_row");
          return [];
        }
        return [trade];
      });
      tradeRowCount = tradeRows.length;
      const deleteResult = await supabase.client
        .from(TRADES_TABLE)
        .delete()
        .eq("politician_key", row.politicianKey);
      if (deleteResult.error)
        throw new Error(`Congressional trades delete failed: ${deleteResult.error.message}`);
      if (tradeRows.length) {
        const { error } = await supabase.client.from(TRADES_TABLE).upsert(
          tradeRows.map((t, i) => ({
            politician_key: row.politicianKey,
            politician_name: row.name,
            symbol: t.symbol,
            transaction_date: t.transactionDate,
            asset: t.asset,
            amounts: t.amounts,
            txn_type: t.txnType,
            fetched_at: fetchedAt,
            updated_at: fetchedAt,
            row_key: `${row.politicianKey}:${t.symbol ?? ""}:${t.transactionDate ?? ""}:${t.txnType ?? ""}:${t.amounts ?? ""}:${i}`
          })),
          { onConflict: "row_key" }
        );
        if (error) throw new Error(`Congressional trades upsert failed: ${error.message}`);
        tradeRowsUpserted = tradeRows.length;
        tradesUpserted += tradeRows.length;
      }
      diagnostics.profiles.push({
        politician: row.name,
        profileFetchStatus,
        profileUrl: congressionalProfileUrl(row.name),
        profileTopLevelKeys: keysOf(profilePayload),
        detectedTradePath: tradeExtraction.path,
        tradeRowCount,
        tradeRowsUpserted
      });
    } catch (error) {
      diagnostics.profiles.push({
        politician: row.name,
        profileFetchStatus,
        profileUrl: congressionalProfileUrl(row.name),
        tradeRowCount,
        tradeRowsUpserted,
        error: error instanceof Error ? error.message : "unknown"
      });
      console.warn("congressional_profile_refresh_failed", {
        politician: row.name,
        status: profileFetchStatus,
        error: error instanceof Error ? error.message : "unknown"
      });
    }
    portfolioRows.push({
      name: row.name,
      politician_key: row.politicianKey,
      ytd_return: row.ytdReturn,
      rank: row.rank,
      ids: row.ids ?? null,
      fetched_at: row.fetchedAt,
      updated_at: row.fetchedAt,
      full_name: profile.fullName,
      current_chamber: profile.currentChamber,
      current_party: profile.currentParty,
      current_district: profile.currentDistrict,
      bio: profile.bio
    });
  }

  if (portfolioRows.length) {
    const duplicatePortfolioKeys = portfolioRows
      .map((r) => r.politician_key)
      .filter((key, index, all) => all.indexOf(key) !== index);
    if (duplicatePortfolioKeys.length) {
      throw new Error(
        `Congressional portfolios upsert batch contains duplicate politician keys: ${[
          ...new Set(duplicatePortfolioKeys)
        ]
          .slice(0, MAX_DUPLICATE_NAMES_TO_LOG)
          .join(", ")}`
      );
    }
    console.info("congressional_portfolios_upsert_batch", {
      rowCount: portfolioRows.length,
      conflictKey: "politician_key",
      duplicateConflictKeyCount: 0
    });
    const { error } = await supabase.client
      .from(PORTFOLIOS_TABLE)
      .upsert(portfolioRows, { onConflict: "politician_key" });
    if (error) {
      console.warn("congressional_portfolios_upsert_failed", {
        rowCount: portfolioRows.length,
        error: error.message
      });
      throw new Error(`Congressional portfolios upsert failed: ${error.message}`);
    }
    diagnostics.portfolioRowsUpserted = portfolioRows.length;
    const keys = portfolioRows.map((r) => `"${r.politician_key.replace(/"/g, '\\"')}"`).join(",");
    const deleteResult = await supabase.client
      .from(PORTFOLIOS_TABLE)
      .delete()
      .not("politician_key", "in", `(${keys})`);
    if (deleteResult.error)
      throw new Error(`Congressional portfolios prune failed: ${deleteResult.error.message}`);
  }
  diagnostics.tradeRowsUpserted = tradesUpserted;
  console.info("congressional_refresh_complete", {
    portfolioRowsUpserted: diagnostics.portfolioRowsUpserted,
    tradeRowsUpserted: diagnostics.tradeRowsUpserted,
    profileCount: diagnostics.profiles.length,
    skippedRows: diagnostics.skippedRows,
    warnings: diagnostics.warnings
  });
  return {
    ok: true as const,
    partial: diagnostics.warnings.length > 0,
    count: rawRows.length,
    upserted: portfolioRows.length,
    meta: diagnostics
  };
}

async function getCachedSpyYtdReturn() {
  const spy = await fetchYahooYtdReturn("SPY");
  return {
    value: spy?.ytdReturn ?? null,
    notice: spy ? null : "Yahoo Finance SPY YTD comparison was unavailable."
  };
}

export async function getCachedCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { portfolios: [], trades: [], notices: [supabase.message] };
  const portfoliosResult = await supabase.client
    .from(PORTFOLIOS_TABLE)
    .select(
      "name,politician_key,ytd_return,rank,ids,fetched_at,full_name,current_chamber,current_party,current_district,bio"
    )
    .order("rank", { ascending: true })
    .limit(20);
  const spyYtd = await getCachedSpyYtdReturn();
  const tradesResult = await supabase.client
    .from(TRADES_TABLE)
    .select("politician_name,politician_key,symbol,transaction_date,asset,amounts,txn_type");
  return {
    spyYtdReturn: spyYtd.value,
    portfolios: (portfoliosResult.data ?? [])
      .filter((r: any) => !CONGRESSIONAL_BLACKLIST_KEYS.has(slug(String(r.name ?? ""))))
      .map((r: any) => ({
        name: r.name,
        politicianKey: r.politician_key,
        ytdReturn: r.ytd_return == null ? null : Number(r.ytd_return),
        rank: Number(r.rank),
        fetchedAt: r.fetched_at,
        ids: Array.isArray(r.ids) ? r.ids : undefined,
        fullName: r.full_name,
        currentChamber: r.current_chamber,
        currentParty: r.current_party,
        currentDistrict: r.current_district,
        bio: r.bio
      })),
    trades: (tradesResult.data ?? [])
      .filter(
        (r: any) =>
          !CONGRESSIONAL_BLACKLIST_KEYS.has(
            slug(String(r.politician_name ?? r.politician_key ?? ""))
          ) && !CONGRESSIONAL_BLACKLIST_KEYS.has(String(r.politician_key ?? ""))
      )
      .map((r: any) => ({
        politicianName: r.politician_name,
        politicianKey: r.politician_key,
        symbol: r.symbol,
        transactionDate: r.transaction_date,
        asset: r.asset,
        amounts: r.amounts,
        txnType: r.txn_type
      })),
    notices: [
      portfoliosResult.error
        ? `Congressional Holdings cache read failed: ${portfoliosResult.error.message}`
        : null,
      tradesResult.error
        ? `Congressional trades cache read failed: ${tradesResult.error.message}`
        : null,
      spyYtd.notice
    ].filter(Boolean)
  };
}
