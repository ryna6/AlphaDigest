import { refreshYahooMarketQuotes } from "../../lib/data/adapters/yahoo-finance";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";

export const config = { schedule: "*/5 * * * 0-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  const runWindow = shouldRunInTorontoWindow({
    windows: [
      { day: 0, startTime: "18:00", endTime: "20:00" },
      { day: 1, startTime: "04:00", endTime: "20:00" },
      { day: 2, startTime: "04:00", endTime: "20:00" },
      { day: 3, startTime: "04:00", endTime: "20:00" },
      { day: 4, startTime: "04:00", endTime: "20:00" },
      { day: 5, startTime: "04:00", endTime: "17:00" }
    ],
    intervalMinutes: 5,
    minuteOffset: 0
  });
  if (!runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-market-quotes", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    return json({ ok: true, skipped: true, job: "refresh-market-quotes", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-market-quotes", source: "yahoo_market_quotes", startedAt, torontoTime: runWindow.torontoTime });
  try {
    const result = await refreshYahooMarketQuotes();
    console.log("scheduled_refresh_complete", { job: "refresh-market-quotes", rowsFetched: result.count, rowsUpserted: result.upserted ?? 0, persisted: result.persisted, ok: result.ok, error: result.error });
    return json({ job: "refresh-market-quotes", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown market quotes refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-market-quotes", error: message });
    return json({ ok: false, job: "refresh-market-quotes", startedAt, error: message }, 500);
  }
}
