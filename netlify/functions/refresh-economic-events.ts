import { economicRefreshDateKeysFromParams, refreshInvestingEconomicEvents } from "../../lib/data/adapters/investing-economic-calendar";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";

export const config = { schedule: "0 * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dateKeys = economicRefreshDateKeysFromParams(new URL(request.url).searchParams);
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const runWindow = shouldRunInTorontoWindow({ hours: [6, 18], minutes: [0] });
  if (!force && !runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-economic-events", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    return json({ ok: true, skipped: true, job: "refresh-economic-events", reason: runWindow.reason, torontoTime: runWindow.torontoTime, startedAt });
  }
  console.log("scheduled_refresh_start", { job: "refresh-economic-events", source: "investing_economic_events", startedAt, dateKeys, torontoTime: runWindow.torontoTime });
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
