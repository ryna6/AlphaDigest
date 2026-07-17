import { runEquityCandleRefresh } from "../../lib/data/equity-candle-ingestion";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const authorized=(req:Request)=>!!process.env.DAILY_CANDLE_WORKER_TOKEN&&req.headers.get("x-alphadigest-worker-token")===process.env.DAILY_CANDLE_WORKER_TOKEN;
export default async function handler(req:Request){
  if(req.method!=="POST")return json({ok:false,error:"POST required"},405);
  if(!authorized(req))return json({ok:false,error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({}));
  const result=await runEquityCandleRefresh({mode:"backfill",table:body.table,symbol:body.symbol,limitSymbols:body.limit,from:body.from,to:body.to,resetFailed:body.resetFailed===true});
  return json({ok:result.symbolsFailed===0,result});
}
