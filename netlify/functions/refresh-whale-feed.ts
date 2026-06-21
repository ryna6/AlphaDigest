import { refreshWhaleFeed } from "../../lib/data/adapters/unusual-whales-whale-feed";
export const config = { schedule: "30 9 * * 1-5" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
export default async function handler() { const startedAt = new Date().toISOString(); console.log("scheduled_refresh_start", { job: "refresh-whale-feed", startedAt, schedule: "30 9 * * 1-5 UTC" }); const result = await refreshWhaleFeed(); console.log("scheduled_refresh_complete", { job: "refresh-whale-feed", ...result }); return json({ job: "refresh-whale-feed", startedAt, finishedAt: new Date().toISOString(), ...result }, result.ok ? 200 : 502); }
