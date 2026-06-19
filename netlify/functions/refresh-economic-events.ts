import { economicRefreshDateKeysFromParams, refreshInvestingEconomicEvents } from "../../lib/data/adapters/investing-economic-calendar";

export const config = { schedule: "5 11,15,21 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dateKeys = economicRefreshDateKeysFromParams(new URL(request.url).searchParams);
  console.log("scheduled_refresh_start", { job: "refresh-economic-events", source: "investing_economic_events", startedAt, dateKeys });
  try {
    const result = await refreshInvestingEconomicEvents(dateKeys);
    console.log("scheduled_refresh_complete", { job: "refresh-economic-events", rowsFetched: result.count, rowsUpserted: result.upserted ?? 0, persisted: result.persisted, ok: result.ok, error: result.error });
    return json({ job: "refresh-economic-events", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown economic events refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-economic-events", error: message });
    return json({ ok: false, job: "refresh-economic-events", startedAt, error: message }, 500);
  }
}
