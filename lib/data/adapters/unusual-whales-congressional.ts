import { createServerSupabaseClient } from "@/lib/db/supabase";

const PORTFOLIOS_TABLE = "unusual_whales_congressional_portfolios";
const TRADES_TABLE = "unusual_whales_congressional_trades";
const LIST_URL = "https://phx.unusualwhales.com/api/portfolios_v2";
const PROFILE_BASE_URL = "https://phx.unusualwhales.com/api/senate_stocks";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim() ?? null;
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const parsed = Number(v.replace(/[%,+ ]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
    transactionDate: str(raw, ["transaction_date", "traded_date"]),
    asset: str(raw, ["asset"]),
    amounts: str(raw, ["amounts", "amount"]),
    txnType: str(raw, ["txn_type", "transaction_type", "type"])
  };
}

export async function refreshCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false as const, error: supabase.message, count: 0, upserted: 0, meta: {} };
  const fetchedAt = new Date().toISOString();
  const response = await fetch(LIST_URL, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`Unusual Whales congressional portfolios fetch failed: ${response.status}`);
  const payload = await response.json();
  const rawRows = payloadRows(payload);
  const rows = rawRows
    .map(normalizeListRow)
    .filter((r): r is ReturnType<typeof normalizeListRow> & {} => Boolean(r))
    .sort((a, b) => (b.ytdReturn ?? -Infinity) - (a.ytdReturn ?? -Infinity))
    .slice(0, 20)
    .map((r, index) => ({ ...r, rank: index + 1, fetchedAt }));

  const diagnostics: Array<Record<string, unknown>> = [];
  let tradesUpserted = 0;
  const portfolioRows = [];
  for (const row of rows) {
    let profile = { fullName: null as string | null, currentChamber: null as string | null, currentParty: null as string | null, currentDistrict: null as string | null, bio: null as string | null };
    let trades: CongressionalTrade[] = [];
    try {
      const profileResponse = await fetch(congressionalProfileUrl(row.name), { headers: headers(), cache: "no-store" });
      if (!profileResponse.ok) throw new Error(`status ${profileResponse.status}`);
      const profilePayload = await profileResponse.json();
      profile = normalizeProfile(profilePayload);
      const tradeRows = payloadRows(profilePayload).map((r) => normalizeTrade(r, row.name)).filter((r): r is CongressionalTrade => Boolean(r));
      trades = tradeRows;
      await supabase.client.from(TRADES_TABLE).delete().eq("politician_key", row.politicianKey);
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
        if (error) throw new Error(error.message);
        tradesUpserted += tradeRows.length;
      }
      diagnostics.push({ politician: row.name, profileFetched: true, tradesFetched: tradeRows.length, tradesUpserted: tradeRows.length });
    } catch (error) {
      diagnostics.push({ politician: row.name, profileFetched: false, error: error instanceof Error ? error.message : "unknown" });
    }
    portfolioRows.push({ name: row.name, politician_key: row.politicianKey, ytd_return: row.ytdReturn, rank: row.rank, fetched_at: row.fetchedAt, updated_at: row.fetchedAt, full_name: profile.fullName, current_chamber: profile.currentChamber, current_party: profile.currentParty, current_district: profile.currentDistrict, bio: profile.bio });
  }

  if (portfolioRows.length) {
    const { error } = await supabase.client.from(PORTFOLIOS_TABLE).upsert(portfolioRows, { onConflict: "politician_key" });
    if (error) throw new Error(`Congressional portfolios upsert failed: ${error.message}`);
    const keys = portfolioRows.map((r) => `"${r.politician_key.replace(/"/g, '\\"')}"`).join(",");
    await supabase.client.from(PORTFOLIOS_TABLE).delete().not("politician_key", "in", `(${keys})`);
  }
  return { ok: true as const, count: rawRows.length, upserted: portfolioRows.length, meta: { normalized: rows.length, tradesUpserted, diagnostics } };
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
