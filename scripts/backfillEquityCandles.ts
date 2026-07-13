import { runEquityCandleRefresh } from "../lib/data/equity-candle-ingestion";
const args=process.argv.slice(2); const get=(n:string)=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined};
runEquityCandleRefresh({ mode:"backfill", table:get("--table") as any, symbol:get("--symbol"), from:get("--from"), to:get("--to"), limitSymbols:get("--limit-symbols")?Number(get("--limit-symbols")):undefined, dryRun:args.includes("--dry-run") }).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exit(1);});
