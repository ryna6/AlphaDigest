import {
  economyMainCards,
  economySummaryCards,
  type EconomyCardSnapshot,
  type EconomyChangeMode,
  type EconomyChangeSnapshot,
  type EconomyDataPoint,
  type EconomyFrequency,
  type EconomyMetricSnapshot
} from "./economy-config";
import type { EconomyPayload } from "./schemas/dashboard";
import { fetchFredSeries } from "./adapters/fred";
import { getSnapshotOrNull, isSnapshotFresh, upsertDashboardSnapshot } from "./adapters/dashboard-snapshots";

const ECONOMY_SNAPSHOT_KEY = "economy:latest";
const ECONOMY_TTL_SECONDS = 6 * 60 * 60;
const TEN_YEAR_RANGE_LABEL = "10Y";


function hasDetailedMetricPayload(payload: EconomyPayload) {
  return payload.mainCards.every((card) =>
    card.metrics.every((metric) =>
      typeof metric.fullName === "string" &&
      typeof metric.unit === "string" &&
      typeof metric.frequency === "string" &&
      typeof metric.chartAxisLabel === "string"
    )
  );
}

function tenYearsAgoDate() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 10);
  return date.toISOString().slice(0, 10);
}

function offsetForFrequency(frequency: EconomyFrequency, period: "qoq" | "yoy") {
  if (frequency === "Quarterly") return period === "qoq" ? 1 : 4;
  if (frequency === "Monthly") return period === "qoq" ? 3 : 12;
  if (frequency === "Weekly") return period === "qoq" ? 13 : 52;
  return period === "qoq" ? 63 : 252;
}

function calculateChange(points: EconomyDataPoint[], frequency: EconomyFrequency, mode: EconomyChangeMode, period: "qoq" | "yoy"): EconomyChangeSnapshot {
  const latest = points.at(-1);
  const comparison = points.at(-1 - offsetForFrequency(frequency, period));
  if (!latest || !comparison || !Number.isFinite(latest.value) || !Number.isFinite(comparison.value)) return { value: null, mode };
  if (mode === "percent") {
    if (comparison.value === 0) return { value: null, mode };
    return { value: ((latest.value - comparison.value) / Math.abs(comparison.value)) * 100, mode };
  }
  return { value: latest.value - comparison.value, mode };
}

async function metricWithFredSnapshot(metric: EconomyMetricSnapshot): Promise<EconomyMetricSnapshot> {
  const result = await fetchFredSeries(metric.seriesId, {
    ...metric.fredOptions,
    observationStart: tenYearsAgoDate(),
    sortOrder: "asc"
  });
  if (!result.ok) {
    return {
      ...metric,
      latestValue: null,
      history: [],
      qoqChange: { value: null, mode: metric.preferredChangeMode },
      yoyChange: { value: null, mode: metric.preferredChangeMode },
      error: result.error
    };
  }
  const history = result.points;
  const latest = history.at(-1);
  return {
    ...metric,
    latestDate: latest?.date,
    latestValue: latest?.value ?? null,
    history,
    qoqChange: calculateChange(history, metric.frequency, metric.preferredChangeMode, "qoq"),
    yoyChange: calculateChange(history, metric.frequency, metric.preferredChangeMode, "yoy")
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
        mode: "live",
        message: `Economy charts use a ${TEN_YEAR_RANGE_LABEL} server-side FRED observation range.`
      }
    ],
    notices: failedSeries.length ? [`Some FRED series were unavailable: ${failedSeries.join(", ")}.`] : []
  };
}

export async function getEconomyPayload(): Promise<{ payload: EconomyPayload; mode: "live" | "cached" | "unavailable"; notices: string[] }> {
  const cached = await getSnapshotOrNull<EconomyPayload>(ECONOMY_SNAPSHOT_KEY);
  if (cached.snapshot && isSnapshotFresh(cached.snapshot) && hasDetailedMetricPayload(cached.snapshot.payload)) {
    return { payload: cached.snapshot.payload, mode: "cached", notices: cached.snapshot.notices };
  }

  const payload = await buildEconomyPayload();
  const write = await upsertDashboardSnapshot(ECONOMY_SNAPSHOT_KEY, payload, {
    ttlSeconds: ECONOMY_TTL_SECONDS,
    mode: "live",
    notices: payload.notices,
    metadata: { provider: "FRED", range: TEN_YEAR_RANGE_LABEL, refreshedBy: "server-fallback" }
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
