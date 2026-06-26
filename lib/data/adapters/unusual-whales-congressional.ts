import { createServerSupabaseClient } from "@/lib/db/supabase";

const PORTFOLIOS_TABLE = "unusual_whales_congressional_portfolios";
const TRADES_TABLE = "unusual_whales_congressional_trades";
const LIST_URL = "https://phx.unusualwhales.com/api/portfolios_v2";
const PROFILE_BASE_URL = "https://phx.unusualwhales.com/api/senate_stocks";

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
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const skipKey = (reason: string) => reason.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();

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
  trades?: CongressionalTrade[];
};

function normalizeListRow(raw: unknown): Omit<CongressionalPortfolio, "rank" | "fetchedAt" | "fullName" | "currentChamber" | "currentParty" | "currentDistrict" | "bio"> | null {
  if (!isRec(raw)) return null;
  const name = str(raw, ["name"]);
  if (!name) return null;
  return { name, politicianKey: slug(name), ytdReturn: num(raw.ytd_return) };
}

function payloadRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRec(payload)) return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.senate_stocks)) return payload.senate_stocks;
  if (isRec(payload.data) && Array.isArray(payload.data.senate_stocks)) return payload.data.senate_stocks;
  if (isRec(payload.data) && Array.isArray(payload.data.results)) return payload.data.results;
  return [];
}

function normalizeProfile(payload: unknown) {
  const root = isRec(payload) ? payload : {};
  const data = isRec(root.data) ? root.data : null;
  const profile = isRec(root.profile) ? root.profile : isRec(root.politician) ? root.politician : data && isRec(data.profile) ? data.profile : data && isRec(data.politician) ? data.politician : data ?? root;
  return {
    fullName: str(profile, ["full_name", "name"]),
    currentChamber: str(profile, ["current_chamber", "chamber"]),
    currentParty: str(profile, ["current_party", "party"]),
    currentDistrict: str(profile, ["current_district", "district"]),
    bio: str(profile, ["bio", "biography"])
  };
}

function normalizeTrade(raw: unknown, politicianName: string): CongressionalTrade | null {
  if (!isRec(raw)) return null;
  return {
    politicianName,
    symbol: str(raw, ["symbol", "ticker"]),
    transactionDate: dateStr(raw, ["transaction_date", "traded_date"]),
    asset: str(raw, ["asset"]),
    amounts: str(raw, ["amounts", "amount"]),
    txnType: str(raw, ["txn_type", "transaction_type", "type"])
  };
}

export async function refreshCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false as const, error: supabase.message, count: 0, upserted: 0, meta: {} };
  const fetchedAt = new Date().toISOString();
  const diagnostics = {
    listFetchStatus: null as number | null,
    rawListRowCount: 0,
    normalizedListRowCount: 0,
    selectedTop20RowCount: 0,
    portfolioRowsUpserted: 0,
    tradeRowsUpserted: 0,
    skippedRows: {} as Record<string, number>,
    profiles: [] as Array<{
      politician: string;
      profileFetchStatus: number | null;
      tradeRowCount: number;
      tradeRowsUpserted: number;
      error?: string;
    }>
  };
  const skip = (reason: string, amount = 1) => {
    const key = skipKey(reason);
    diagnostics.skippedRows[key] = (diagnostics.skippedRows[key] ?? 0) + amount;
  };

  const response = await fetch(LIST_URL, { headers: headers(), cache: "no-store" });
  diagnostics.listFetchStatus = response.status;
  console.info("congressional_list_fetch", { status: response.status, ok: response.ok });
  if (!response.ok) {
    const error = `Unusual Whales congressional portfolios fetch failed: ${response.status}`;
    console.warn("congressional_refresh_failed", { stage: "list_fetch", status: response.status });
    return { ok: false as const, error, count: 0, upserted: 0, meta: diagnostics };
  }

  const payload = await response.json();
  const rawRows = payloadRows(payload);
  diagnostics.rawListRowCount = rawRows.length;
  const normalizedRows = rawRows.flatMap((raw) => {
    const row = normalizeListRow(raw);
    if (!row) {
      skip(isRec(raw) && !str(raw, ["name"]) ? "missing_name" : "invalid_list_row");
      return [];
    }
    return [row];
  });
  diagnostics.normalizedListRowCount = normalizedRows.length;
  const rows = normalizedRows
    .sort((a, b) => (b.ytdReturn ?? -Infinity) - (a.ytdReturn ?? -Infinity))
    .slice(0, 20)
    .map((r, index) => ({ ...r, rank: index + 1, fetchedAt }));
  diagnostics.selectedTop20RowCount = rows.length;
  console.info("congressional_list_normalized", {
    rawListRowCount: diagnostics.rawListRowCount,
    normalizedListRowCount: diagnostics.normalizedListRowCount,
    selectedTop20RowCount: diagnostics.selectedTop20RowCount,
    skippedRows: diagnostics.skippedRows
  });

  let tradesUpserted = 0;
  const portfolioRows = [];
  for (const row of rows) {
    let profile = { fullName: null as string | null, currentChamber: null as string | null, currentParty: null as string | null, currentDistrict: null as string | null, bio: null as string | null };
    let profileFetchStatus: number | null = null;
    let tradeRowsUpserted = 0;
    let tradeRowCount = 0;
    try {
      const profileResponse = await fetch(congressionalProfileUrl(row.name), { headers: headers(), cache: "no-store" });
      profileFetchStatus = profileResponse.status;
      if (!profileResponse.ok) throw new Error(`status ${profileResponse.status}`);
      const profilePayload = await profileResponse.json();
      profile = normalizeProfile(profilePayload);
      const tradeRows = payloadRows(profilePayload).flatMap((raw) => {
        const trade = normalizeTrade(raw, row.name);
        if (!trade) {
          skip("invalid_trade_row");
          return [];
        }
        return [trade];
      });
      tradeRowCount = tradeRows.length;
      const deleteResult = await supabase.client.from(TRADES_TABLE).delete().eq("politician_key", row.politicianKey);
      if (deleteResult.error) throw new Error(`Congressional trades delete failed: ${deleteResult.error.message}`);
      if (tradeRows.length) {
        const { error } = await supabase.client.from(TRADES_TABLE).upsert(tradeRows.map((t, i) => ({
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
        })), { onConflict: "row_key" });
        if (error) throw new Error(`Congressional trades upsert failed: ${error.message}`);
        tradeRowsUpserted = tradeRows.length;
        tradesUpserted += tradeRows.length;
      }
      diagnostics.profiles.push({ politician: row.name, profileFetchStatus, tradeRowCount, tradeRowsUpserted });
    } catch (error) {
      diagnostics.profiles.push({ politician: row.name, profileFetchStatus, tradeRowCount, tradeRowsUpserted, error: error instanceof Error ? error.message : "unknown" });
      console.warn("congressional_profile_refresh_failed", { politician: row.name, status: profileFetchStatus, error: error instanceof Error ? error.message : "unknown" });
    }
    portfolioRows.push({ name: row.name, politician_key: row.politicianKey, ytd_return: row.ytdReturn, rank: row.rank, fetched_at: row.fetchedAt, updated_at: row.fetchedAt, full_name: profile.fullName, current_chamber: profile.currentChamber, current_party: profile.currentParty, current_district: profile.currentDistrict, bio: profile.bio });
  }

  if (portfolioRows.length) {
    const { error } = await supabase.client.from(PORTFOLIOS_TABLE).upsert(portfolioRows, { onConflict: "politician_key" });
    if (error) {
      console.warn("congressional_portfolios_upsert_failed", { rowCount: portfolioRows.length, error: error.message });
      throw new Error(`Congressional portfolios upsert failed: ${error.message}`);
    }
    diagnostics.portfolioRowsUpserted = portfolioRows.length;
    const keys = portfolioRows.map((r) => `"${r.politician_key.replace(/"/g, '\\"')}"`).join(",");
    const deleteResult = await supabase.client.from(PORTFOLIOS_TABLE).delete().not("politician_key", "in", `(${keys})`);
    if (deleteResult.error) throw new Error(`Congressional portfolios prune failed: ${deleteResult.error.message}`);
  }
  diagnostics.tradeRowsUpserted = tradesUpserted;
  console.info("congressional_refresh_complete", {
    portfolioRowsUpserted: diagnostics.portfolioRowsUpserted,
    tradeRowsUpserted: diagnostics.tradeRowsUpserted,
    profileCount: diagnostics.profiles.length,
    skippedRows: diagnostics.skippedRows
  });
  return { ok: true as const, count: rawRows.length, upserted: portfolioRows.length, meta: diagnostics };
}

export async function getCachedCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { portfolios: [], trades: [], notices: [supabase.message] };
  const portfoliosResult = await supabase.client.from(PORTFOLIOS_TABLE).select("name,politician_key,ytd_return,rank,fetched_at,full_name,current_chamber,current_party,current_district,bio").order("rank", { ascending: true }).limit(20);
  const tradesResult = await supabase.client.from(TRADES_TABLE).select("politician_name,politician_key,symbol,transaction_date,asset,amounts,txn_type");
  return {
    portfolios: (portfoliosResult.data ?? []).map((r: any) => ({ name: r.name, politicianKey: r.politician_key, ytdReturn: r.ytd_return == null ? null : Number(r.ytd_return), rank: Number(r.rank), fetchedAt: r.fetched_at, fullName: r.full_name, currentChamber: r.current_chamber, currentParty: r.current_party, currentDistrict: r.current_district, bio: r.bio })),
    trades: (tradesResult.data ?? []).map((r: any) => ({ politicianName: r.politician_name, politicianKey: r.politician_key, symbol: r.symbol, transactionDate: r.transaction_date, asset: r.asset, amounts: r.amounts, txnType: r.txn_type })),
    notices: [portfoliosResult.error ? `Congressional Holdings cache read failed: ${portfoliosResult.error.message}` : null, tradesResult.error ? `Congressional trades cache read failed: ${tradesResult.error.message}` : null].filter(Boolean)
  };
}
