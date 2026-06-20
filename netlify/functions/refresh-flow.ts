import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
import { refreshDarkPoolFlows } from "../../lib/data/adapters/unusual-whales-dark-pool";
import { refreshInsiderTrades } from "../../lib/data/adapters/unusual-whales-insider-trades";
export const config = { schedule: "45 9 * * *" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
export default async function handler(){const startedAt=new Date().toISOString();console.log("scheduled_refresh_start",{job:"refresh-flow",startedAt,schedule:"45 9 * * * UTC"});const [darkPool,insiderTrades]=await Promise.all([refreshDarkPoolFlows(),refreshInsiderTrades()]);const snapshot=await refreshDashboardSnapshot("flow:latest");const ok=darkPool.ok&&insiderTrades.ok&&snapshot.ok;console.log("scheduled_refresh_complete",{job:"refresh-flow",darkPool,insiderTrades,snapshotKey:snapshot.key,snapshotPersisted:snapshot.persisted,ok});return json({job:"refresh-flow",startedAt,finishedAt:new Date().toISOString(),ok,darkPool,insiderTrades,snapshot},ok?200:502)}
