import { refreshYahooMarketQuotes } from "../../lib/data/adapters/yahoo-finance";
import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";

export const config = { schedule: "*/10 14-22 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export default async function handler() {
  const startedAt = new Date().toISOString();
  console.log("scheduled_refresh_start", { job: "refresh-markets", startedAt, sources: ["yahoo_market_quotes"], snapshotKey: "markets:latest" });
  try {
    const marketQuotes = await refreshYahooMarketQuotes();
    const snapshot = await refreshDashboardSnapshot("markets:latest");
    const ok = marketQuotes.ok && snapshot.ok;
    console.log("scheduled_refresh_complete", { job: "refresh-markets", quoteRows: marketQuotes.count, quoteUpserted: marketQuotes.upserted ?? 0, snapshotKey: snapshot.key, snapshotPersisted: snapshot.persisted, ok });
    return json({ job: "refresh-markets", startedAt, finishedAt: new Date().toISOString(), ok, marketQuotes, snapshot }, ok ? 200 : 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown markets refresh error";
    console.error("scheduled_refresh_error", { job: "refresh-markets", error: message });
    return json({ ok: false, job: "refresh-markets", startedAt, error: message }, 500);
  }
}
