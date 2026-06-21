import { refreshDarkPoolFlows } from "../../lib/data/adapters/unusual-whales-dark-pool";
import { shouldRunInTorontoWindow } from "../../lib/schedule/toronto";

export const config = { schedule: "0 * * * 1-5" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const force = new URL(request.url).searchParams.get("force") === "true";
  const runWindow = shouldRunInTorontoWindow({ days: [1, 2, 3, 4, 5], startTime: "04:00", endTime: "20:00", intervalMinutes: 120, minuteOffset: 0 });
  if (!force && !runWindow.shouldRun) {
    console.info("scheduled_refresh_skipped", { job: "refresh-dark-pool", reason: runWindow.reason, torontoTime: runWindow.torontoTime });
    return json({ ok: true, skipped: true, job: "refresh-dark-pool", startedAt, reason: runWindow.reason, torontoTime: runWindow.torontoTime });
  }
  console.log("scheduled_refresh_start", { job: "refresh-dark-pool", startedAt, schedule: "Every 2 hours Mon-Fri 4 AM-8 PM America/Toronto", torontoTime: runWindow.torontoTime });
  const result = await refreshDarkPoolFlows();
  console.log("scheduled_refresh_complete", { job: "refresh-dark-pool", ...result });
  return json({ job: "refresh-dark-pool", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502);
}
