import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { economyMainCards, type EconomyDataPoint, type EconomyMetricDefinition } from "../economy-config";
import { fetchFredSeries } from "./fred";
import { payloadContentHash, updateRefreshMetadata } from "./supabase-refresh";

export const ECONOMY_OBSERVATIONS_TABLE = "fred_economy";
export const ECONOMY_PROVIDER = "fred";
export const ECONOMY_REFRESH_SOURCE = "fred_economy";
const THIRTY_YEARS = 30;

export type EconomyObservationReadResult = { ok: true; points: EconomyDataPoint[] } | { ok: false; points: EconomyDataPoint[]; error: string };
export type RefreshEconomyObservationsResult = { ok: boolean; count: number; upserted: number; seriesFetched: number; seriesSkipped: number; seriesFailed: string[]; error?: string };
export type LatestEconomyObservationDatesResult = { ok: true; latestDates: Map<string, string> } | { ok: false; latestDates: Map<string, string>; error: string };

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

export async function latestEconomyObservationDates(seriesIds: string[]): Promise<LatestEconomyObservationDatesResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { ok: false, latestDates: new Map(), error: supabase.message };
  const uniqueSeriesIds = Array.from(new Set(seriesIds));
  if (!uniqueSeriesIds.length) return { ok: true, latestDates: new Map() };
  const results = await Promise.all(
    uniqueSeriesIds.map(async (seriesId) => {
      const { data, error } = await supabase.client
        .from(ECONOMY_OBSERVATIONS_TABLE)
        .select("date")
        .eq("provider", ECONOMY_PROVIDER)
        .eq("series_id", seriesId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { seriesId, date: typeof data?.date === "string" ? data.date : null, error };
    })
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) return { ok: false, latestDates: new Map(), error: failed.error.message };
  return {
    ok: true,
    latestDates: new Map(results.flatMap((result) => result.date ? [[result.seriesId, result.date] as const] : []))
  };
}

async function latestSavedObservationDate(client: SupabaseClient, seriesId: string) {
  const { data, error } = await client
    .from(ECONOMY_OBSERVATIONS_TABLE)
    .select("date")
    .eq("provider", ECONOMY_PROVIDER)
    .eq("series_id", seriesId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return typeof data?.date === "string" ? data.date : null;
}

function dayAfter(dateText: string) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
  if (!supabase.ok) return { ok: false, count: 0, upserted: 0, seriesFetched: 0, seriesSkipped: 0, seriesFailed: [], error: supabase.message };
  const seriesFailed: string[] = [];
  let count = 0;
  let upserted = 0;
  let seriesFetched = 0;
  let seriesSkipped = 0;
  const metrics = configuredMetrics();
  console.info("fred_economy_refresh_configured", { totalConfiguredSeries: metrics.length, table: ECONOMY_OBSERVATIONS_TABLE });
  for (const { card, metric } of metrics) {
    let latestDate: string | null = null;
    try {
      latestDate = await latestSavedObservationDate(supabase.client, metric.seriesId);
    } catch (error) {
      seriesFailed.push(metric.seriesId);
      console.warn("fred_economy_latest_date_failed", { seriesId: metric.seriesId, metricKey: metric.id, error: error instanceof Error ? error.message : "Unknown Supabase latest-date error" });
      continue;
    }
    const incrementalStart = latestDate ? dayAfter(latestDate) : null;
    const observationStart = incrementalStart ?? thirtyYearsAgoDate();
    console.info("fred_economy_series_fetch_start", { seriesId: metric.seriesId, metricKey: metric.id, latestSavedDate: latestDate, observationStart });
    const result = await fetchFredSeries(metric.seriesId, { ...metric.fredOptions, observationStart, sortOrder: "asc" });
    if (!result.ok) {
      seriesFailed.push(metric.seriesId);
      console.warn("fred_economy_series_failed", { seriesId: metric.seriesId, metricKey: metric.id, error: result.error });
      continue;
    }
    seriesFetched += 1;
    count += result.points.length;
    if (!result.points.length) {
      seriesSkipped += 1;
      console.info("fred_economy_series_no_new_data", { seriesId: metric.seriesId, metricKey: metric.id, latestSavedDate: latestDate });
      continue;
    }
    const write = await upsertMetricObservations(supabase.client, card.id, metric, result.points);
    upserted += write.upserted;
    console.info("fred_economy_series_upserted", { seriesId: metric.seriesId, metricKey: metric.id, newObservationsFetched: result.points.length, observationsUpserted: write.upserted });
  }
  await updateRefreshMetadata(supabase.client, ECONOMY_REFRESH_SOURCE, {
    ok: seriesFetched > 0,
    rowCount: count,
    changed: null,
    contentHash: payloadContentHash([{ provider: ECONOMY_PROVIDER, count, upserted, seriesFetched, seriesFailed }]),
    meta: { provider: ECONOMY_PROVIDER, historyYears: THIRTY_YEARS, seriesFetched, seriesSkipped, seriesFailed, incremental: true }
  });
  return { ok: seriesFetched > 0, count, upserted, seriesFetched, seriesSkipped, seriesFailed, error: seriesFetched > 0 ? undefined : "No FRED series refreshed." };
}
