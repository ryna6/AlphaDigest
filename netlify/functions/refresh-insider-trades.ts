import { refreshInsiderTrades } from "../../lib/data/adapters/unusual-whales-insider-trades";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";

export const config = { schedule: "0 * * * *" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const force = new URL(request.url).searchParams.get("force") === "true";
  const runWindow = shouldRunInTorontoWindow({ intervalMinutes: 120, minuteOffset: 0 });
  if (!force && !runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-insider-trades", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    return json({ ok: true, skipped: true, job: "refresh-insider-trades", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-insider-trades", startedAt, schedule: "Every 2 hours America/Toronto", torontoTime: runWindow.torontoTime });
  const result = await refreshInsiderTrades();
  console.log("scheduled_refresh_complete", { job: "refresh-insider-trades", ...result });
  return json({ job: "refresh-insider-trades", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
}
