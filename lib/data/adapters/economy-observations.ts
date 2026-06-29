import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { economyMainCards, type EconomyDataPoint, type EconomyMetricDefinition } from "../economy-config";
import { fetchFredSeries } from "./fred";
import { payloadContentHash, updateRefreshMetadata } from "./supabase-refresh";

export const ECONOMY_OBSERVATIONS_TABLE = "economy_observations";
export const ECONOMY_PROVIDER = "fred";
export const ECONOMY_REFRESH_SOURCE = "economy_observations";
const THIRTY_YEARS = 30;

export type EconomyObservationReadResult = { ok: true; points: EconomyDataPoint[] } | { ok: false; points: EconomyDataPoint[]; error: string };
export type RefreshEconomyObservationsResult = { ok: boolean; count: number; upserted: number; seriesFetched: number; seriesFailed: string[]; error?: string };

export function thirtyYearsAgoDate() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - THIRTY_YEARS);
  return date.toISOString().slice(0, 10);
}

function configuredMetrics() {
  return economyMainCards.flatMap((card) => card.metrics.map((metric) => ({ card, metric })));
}

export async function readEconomyObservations(metric: EconomyMetricDefinition, observationStart: string): Promise<EconomyObservationReadResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false, points: [], error: supabase.message };
  const { data, error } = await supabase.client
    .from(ECONOMY_OBSERVATIONS_TABLE)
    .select("date,value")
    .eq("provider", ECONOMY_PROVIDER)
    .eq("series_id", metric.seriesId)
    .gte("date", observationStart)
    .order("date", { ascending: true });
  if (error) return { ok: false, points: [], error: error.message };
  const points = (data ?? []).flatMap((row) => {
    const value = Number(row.value);
    return typeof row.date === "string" && Number.isFinite(value) ? [{ date: row.date, value }] : [];
  });
  return { ok: true, points };
}

async function upsertMetricObservations(client: SupabaseClient, cardId: string, metric: EconomyMetricDefinition, points: EconomyDataPoint[]) {
  if (!points.length) return { upserted: 0 };
  const now = new Date().toISOString();
  const rows = points.map((point) => ({
    provider: ECONOMY_PROVIDER,
    series_id: metric.seriesId,
    metric_key: metric.id,
    card_key: cardId,
    date: point.date,
    value: point.value,
    unit: metric.unit,
    frequency: metric.frequency,
    seasonal_adjustment: metric.seasonalAdjustment,
    source_label: metric.dataSource ?? "FRED",
    updated_at: now
  }));
  const { error } = await client.from(ECONOMY_OBSERVATIONS_TABLE).upsert(rows, { onConflict: "provider,series_id,date" });
  if (error) throw error;
  return { upserted: rows.length };
}

export async function refreshEconomyObservations(): Promise<RefreshEconomyObservationsResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false, count: 0, upserted: 0, seriesFetched: 0, seriesFailed: [], error: supabase.message };
  const seriesFailed: string[] = [];
  let count = 0;
  let upserted = 0;
  let seriesFetched = 0;
  for (const { card, metric } of configuredMetrics()) {
    const result = await fetchFredSeries(metric.seriesId, { ...metric.fredOptions, observationStart: thirtyYearsAgoDate(), sortOrder: "asc" });
    if (!result.ok) {
      seriesFailed.push(metric.seriesId);
      console.warn("fred_economy_series_failed", { seriesId: metric.seriesId, metricKey: metric.id, error: result.error });
      continue;
    }
    seriesFetched += 1;
    count += result.points.length;
    const write = await upsertMetricObservations(supabase.client, card.id, metric, result.points);
    upserted += write.upserted;
    console.info("fred_economy_series_upserted", { seriesId: metric.seriesId, metricKey: metric.id, points: result.points.length });
  }
  await updateRefreshMetadata(supabase.client, ECONOMY_REFRESH_SOURCE, {
    ok: seriesFetched > 0,
    rowCount: count,
    changed: null,
    contentHash: payloadContentHash([{ provider: ECONOMY_PROVIDER, count, upserted, seriesFetched, seriesFailed }]),
    meta: { provider: ECONOMY_PROVIDER, historyYears: THIRTY_YEARS, seriesFetched, seriesFailed }
  });
  return { ok: seriesFetched > 0, count, upserted, seriesFetched, seriesFailed, error: seriesFetched > 0 ? undefined : "No FRED series refreshed." };
}
