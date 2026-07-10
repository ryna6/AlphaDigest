import { refreshCryptoDailyCandles } from "../../lib/data/daily-candle-refresh";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";
export const config = { schedule: "45 22 * * *" };
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json"}});
export default async function handler(){ const run=await startJobRun({jobName:"Crypto Daily Candles",functionName:"refresh-crypto-daily-candles",source:"Unusual Whales"}); try{ const result=await refreshCryptoDailyCandles(); await finishJobRun(run,{status:result.failedSymbols?"warning":"success",rowsFetched:result.successfulSymbols,rowsInserted:result.rowsUpserted,rowsDeleted:result.rowsPruned,metadata:result as any}); return json({ok:true,result}); }catch(e){const msg=(e as Error).message; await finishJobRun(run,{status:"error",errorMessage:msg}); return json({ok:false,error:msg},500);} }
