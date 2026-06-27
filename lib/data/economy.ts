import { economyMainCards, economySummaryCards, type EconomyCardSnapshot, type EconomyMetricSnapshot } from "./economy-config";
import type { EconomyPayload } from "./schemas/dashboard";
import { fetchFredSeries } from "./adapters/fred";
import { getSnapshotOrNull, isSnapshotFresh, upsertDashboardSnapshot } from "./adapters/dashboard-snapshots";

const ECONOMY_SNAPSHOT_KEY = "economy:latest";
const ECONOMY_TTL_SECONDS = 6 * 60 * 60;
const HISTORY_POINTS = 36;

async function metricWithFredSnapshot(metric: EconomyMetricSnapshot): Promise<EconomyMetricSnapshot> {
  if (!metric.seriesId) return { ...metric, latestValue: null, history: [] };
  const result = await fetchFredSeries(metric.seriesId, metric.fredOptions);
  if (!result.ok) return { ...metric, latestValue: null, history: [], error: result.error };
  const history = result.points.slice(-HISTORY_POINTS);
  const latest = history.at(-1);
  return {
    ...metric,
    latestDate: latest?.date,
    latestValue: latest?.value ?? null,
    history
  };
}

async function buildEconomyPayload(): Promise<EconomyPayload> {
  const mainCards = await Promise.all(
    economyMainCards.map(async (card): Promise<EconomyCardSnapshot> => ({
      ...card,
      metrics: await Promise.all(card.metrics.map((metric) => metricWithFredSnapshot(metric)))
    }))
  );

  const failedSeries = mainCards.flatMap((card) => card.metrics.filter((metric) => metric.error).map((metric) => metric.seriesId ?? metric.id));

  return {
    summaryCards: economySummaryCards,
    mainCards,
    sourceMeta: [
      {
        source: "FRED",
        sourceUrl: "https://api.stlouisfed.org/fred/series/observations",
        lastUpdated: new Date().toISOString(),
        mode: "live"
      }
    ],
    notices: failedSeries.length ? [`Some FRED series were unavailable: ${failedSeries.join(", ")}.`] : []
  };
}

export async function getEconomyPayload(): Promise<{ payload: EconomyPayload; mode: "live" | "cached" | "unavailable"; notices: string[] }> {
  const cached = await getSnapshotOrNull<EconomyPayload>(ECONOMY_SNAPSHOT_KEY);
  if (cached.snapshot && isSnapshotFresh(cached.snapshot)) {
    return { payload: cached.snapshot.payload, mode: "cached", notices: cached.snapshot.notices };
  }

  const payload = await buildEconomyPayload();
  const write = await upsertDashboardSnapshot(ECONOMY_SNAPSHOT_KEY, payload, {
    ttlSeconds: ECONOMY_TTL_SECONDS,
    mode: "live",
    notices: payload.notices,
    metadata: { provider: "FRED", refreshedBy: "server-fallback" }
  });
  if (!write.ok && cached.snapshot) {
    return {
      payload: cached.snapshot.payload,
      mode: "cached",
      notices: [...cached.snapshot.notices, "Showing cached economy data because the latest snapshot could not be persisted."]
    };
  }
  return { payload, mode: "live", notices: payload.notices };
}
