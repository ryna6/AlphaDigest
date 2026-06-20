import { refreshDarkPoolFlows } from "../../lib/data/adapters/unusual-whales-dark-pool";
export const config = { schedule: "15 9 * * *" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
export default async function handler(){const startedAt=new Date().toISOString();console.log("scheduled_refresh_start",{job:"refresh-dark-pool",startedAt,schedule:"15 9 * * * UTC"});const result=await refreshDarkPoolFlows();console.log("scheduled_refresh_complete",{job:"refresh-dark-pool",...result});return json({job:"refresh-dark-pool",startedAt,finishedAt:new Date().toISOString(),...result},result.ok?200:502)}
