import { refreshDashboardSnapshot } from "../../lib/data/live-dashboard";
export const config = { schedule: "0 10 * * *" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
export default async function handler(){const startedAt=new Date().toISOString();console.log("scheduled_refresh_start",{job:"refresh-ownership",startedAt,schedule:"0 10 * * * UTC",status:"fixture-backed"});const snapshot=await refreshDashboardSnapshot("ownership:latest");return json({job:"refresh-ownership",startedAt,finishedAt:new Date().toISOString(),ok:snapshot.ok,fixtureBacked:true,snapshot},snapshot.ok?200:502)}
