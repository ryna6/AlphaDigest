import { refreshYahooMarketQuotes } from "../../lib/data/adapters/yahoo-finance";

export const config = { schedule: "*/15 14-22 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-market-quotes", source: "yahoo_market_quotes", startedAt });
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
