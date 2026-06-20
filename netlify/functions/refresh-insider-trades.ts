import { refreshInsiderTrades } from "../../lib/data/adapters/unusual-whales-insider-trades";
export const config = { schedule: "30 9 * * *" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
export default async function handler(){const startedAt=new Date().toISOString();console.log("scheduled_refresh_start",{job:"refresh-insider-trades",startedAt,schedule:"30 9 * * * UTC"});const result=await refreshInsiderTrades();console.log("scheduled_refresh_complete",{job:"refresh-insider-trades",...result});return json({job:"refresh-insider-trades",startedAt,finishedAt:new Date().toISOString(),...result},result.ok?200:502)}
