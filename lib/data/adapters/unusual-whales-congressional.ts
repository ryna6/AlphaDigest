import { createServerSupabaseClient } from "@/lib/db/supabase";

const TABLE = "unusual_whales_congressional_portfolios";
const URL = "https://phx.unusualwhales.com/api/portfolios_v2";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (r: Rec, keys: string[]) => keys.map((k) => r[k]).find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim() ?? null;
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const parsed = Number(v.replace(/[%,+ ]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

function headers(): Record<string, string> {
  return { accept: "application/json" };
}

export type CongressionalPortfolio = {
  name: string;
  ytdReturn: number | null;
  rank: number;
  fetchedAt: string;
};

function normalizeRow(raw: unknown): Omit<CongressionalPortfolio, "rank" | "fetchedAt"> | null {
  if (!isRec(raw)) return null;
  const name = str(raw, ["name"]);
  if (!name) return null;
  return { name, ytdReturn: num(raw.ytd_return) };
}

export async function refreshCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false as const, error: supabase.message, count: 0, upserted: 0, meta: {} };
  const fetchedAt = new Date().toISOString();
  const response = await fetch(URL, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`Unusual Whales congressional portfolios fetch failed: ${response.status}`);
  const payload = await response.json();
  const rawRows = Array.isArray(payload) ? payload : isRec(payload) && Array.isArray(payload.data) ? payload.data : [];
  const rows = rawRows
    .map(normalizeRow)
    .filter((r): r is Omit<CongressionalPortfolio, "rank" | "fetchedAt"> => Boolean(r))
    .sort((a, b) => (b.ytdReturn ?? -Infinity) - (a.ytdReturn ?? -Infinity))
    .slice(0, 20)
    .map((r, index) => ({ ...r, rank: index + 1, fetchedAt }));
  if (rows.length) {
    const { error } = await supabase.client.from(TABLE).upsert(
      rows.map((r) => ({ name: r.name, ytd_return: r.ytdReturn, rank: r.rank, fetched_at: r.fetchedAt, updated_at: r.fetchedAt })),
      { onConflict: "name" }
    );
    if (error) throw new Error(`Congressional portfolios upsert failed: ${error.message}`);
    const names = rows.map((r) => `"${r.name.replace(/"/g, '\\"')}"`).join(",");
    await supabase.client.from(TABLE).delete().not("name", "in", `(${names})`);
  }
  return { ok: true as const, count: rawRows.length, upserted: rows.length, meta: { responsePath: Array.isArray(payload) ? "root" : "data", normalized: rows.length } };
}

export async function getCachedCongressionalPortfolios() {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { portfolios: [], notices: [supabase.message] };
  const { data, error } = await supabase.client.from(TABLE).select("name,ytd_return,rank,fetched_at").order("rank", { ascending: true }).limit(20);
  return {
    portfolios: (data ?? []).map((r: any) => ({ name: r.name, ytdReturn: r.ytd_return == null ? null : Number(r.ytd_return), rank: Number(r.rank), fetchedAt: r.fetched_at })),
    notices: error ? [`Congressional Holdings cache read failed: ${error.message}`] : []
  };
}
