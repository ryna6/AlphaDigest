export type FredPoint = {
  date: string;
  value: number;
};

export type FredSeriesOptions = {
  observationStart?: string;
  observationEnd?: string;
  sortOrder?: "asc" | "desc";
  units?: string;
  frequency?: string;
};

export type FredSeriesResult =
  | { ok: true; points: FredPoint[] }
  | { ok: false; points: FredPoint[]; error: string };

const FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown FRED request error";
}

export async function fetchFredSeries(seriesId: string, options: FredSeriesOptions = {}): Promise<FredSeriesResult> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return { ok: false, points: [], error: "FRED_API_KEY is not configured server-side." };

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: options.sortOrder ?? "asc"
  });
  if (options.observationStart) params.set("observation_start", options.observationStart);
  if (options.observationEnd) params.set("observation_end", options.observationEnd);
  if (options.units) params.set("units", options.units);
  if (options.frequency) params.set("frequency", options.frequency);

  try {
    const response = await fetch(`${FRED_OBSERVATIONS_URL}?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return { ok: false, points: [], error: `FRED ${seriesId} request failed with ${response.status}.` };
    const json = (await response.json()) as { observations?: Array<{ date?: unknown; value?: unknown }>; error_message?: string };
    if (json.error_message) return { ok: false, points: [], error: `FRED ${seriesId} error: ${json.error_message}` };

    const points = (json.observations ?? []).flatMap((observation) => {
      if (typeof observation.date !== "string" || typeof observation.value !== "string") return [];
      if (observation.value === ".") return [];
      const value = Number(observation.value);
      if (!Number.isFinite(value)) return [];
      return [{ date: observation.date, value }];
    });

    return { ok: true, points };
  } catch (error) {
    return { ok: false, points: [], error: `FRED ${seriesId} request failed: ${safeErrorMessage(error)}` };
  }
}
