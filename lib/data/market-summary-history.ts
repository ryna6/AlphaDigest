import { createServerSupabaseClient } from "@/lib/db/supabase";

export type MarketSummaryMetricKey =
  | "risk_on_off_ratio"
  | "put_call_total"
  | "put_call_index"
  | "put_call_equity";

const HISTORY_RETENTION_HOURS = 96;
const HISTORY_LOOKBACK_HOURS = 24;
const COMPARISON_TOLERANCE_HOURS = 18;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatSignedWholePercent(value: number | null | undefined) {
  if (!isFiniteNumber(value)) return undefined;
  const rounded = Math.round(value);
  if (Object.is(rounded, -0) || rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

async function comparisonChangePercent(metricKey: MarketSummaryMetricKey, value: number, observedAt: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return null;
  const observedTime = new Date(observedAt).getTime();
  if (!Number.isFinite(observedTime)) return null;
  const target = observedTime - HISTORY_LOOKBACK_HOURS * 60 * 60 * 1000;
  const start = new Date(target - COMPARISON_TOLERANCE_HOURS * 60 * 60 * 1000).toISOString();
  const end = new Date(target + COMPARISON_TOLERANCE_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.client
    .from("market_summary_history")
    .select("value, observed_at")
    .eq("metric_key", metricKey)
    .gte("observed_at", start)
    .lte("observed_at", end)
    .order("observed_at", { ascending: false })
    .limit(200);
  if (error || !data?.length) return null;
  const closest = data
    .map((row) => ({ value: Number(row.value), distance: Math.abs(new Date(String(row.observed_at)).getTime() - target) }))
    .filter((row) => Number.isFinite(row.value) && row.value !== 0 && Number.isFinite(row.distance))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!closest) return null;
  return ((value - closest.value) / closest.value) * 100;
}

export async function recordMarketSummaryHistory(
  observations: Array<{
    metricKey: MarketSummaryMetricKey;
    value: number | null | undefined;
    observedAt?: string | null;
    source: string;
    freshness?: string | null;
  }>
) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false, changes: {} as Partial<Record<MarketSummaryMetricKey, number | null>>, error: supabase.message };
  const now = new Date().toISOString();
  const valid = observations
    .filter((item) => isFiniteNumber(item.value))
    .map((item) => ({
      metric_key: item.metricKey,
      value: item.value as number,
      observed_at: item.observedAt ?? now,
      source: item.source,
      freshness: item.freshness ?? null
    }));
  const changes: Partial<Record<MarketSummaryMetricKey, number | null>> = {};
  await Promise.all(
    valid.map(async (row) => {
      changes[row.metric_key as MarketSummaryMetricKey] = await comparisonChangePercent(
        row.metric_key as MarketSummaryMetricKey,
        row.value,
        row.observed_at
      );
    })
  );
  if (valid.length) {
    const { error } = await supabase.client.from("market_summary_history").insert(valid);
    if (error) return { ok: false, changes, error: error.message };
  }
  const cutoff = new Date(Date.now() - HISTORY_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  const { error: pruneError } = await supabase.client
    .from("market_summary_history")
    .delete()
    .lt("observed_at", cutoff);
  return { ok: !pruneError, changes, error: pruneError?.message };
}
