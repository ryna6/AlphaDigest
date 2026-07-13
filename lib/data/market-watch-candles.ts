import type { DailyCandle } from "./daily-candles";

export type MarketWatchSignal = "new_high" | "new_low" | "crossed_above" | "crossed_below" | "at";
export type MarketWatchItem = { symbol:string; signal:MarketWatchSignal; latestPrice:number; referenceValue:number; latestTradingDate:string; magnitudePct:number|null };
export type MarketWatchSection = { available:boolean; items:MarketWatchItem[]; eligibleSymbols:number; reason:string|null };
export type MarketWatchResult = { asOfDate:string|null; highs52Week:MarketWatchSection; lows52Week:MarketWatchSection; crosses200Day:MarketWatchSection; crosses200Week:MarketWatchSection; coverage:{ configuredSymbols:number; staleSymbols:string[]; earliestTradingDate:string|null; maxWeeklyObservations:number; staleDateRule:string } };
const PRIOR_52W_SESSIONS = 252;
const MA_SESSIONS = 200;
const LIMIT = 5;
function valid(c:DailyCandle){return [c.open,c.high,c.low,c.close].every(n=>Number.isFinite(n)&&n>0)&&c.high>=c.low&&c.high>=c.open&&c.high>=c.close&&c.low<=c.open&&c.low<=c.close;}
function avg(ns:number[]){return ns.reduce((a,b)=>a+b,0)/ns.length;}
function mag(latest:number, ref:number){return ref ? ((latest-ref)/ref)*100 : null;}
function roundPrice(n:number){return Math.round(n*100)/100;}
function weekKey(date:string){const d=new Date(`${date}T00:00:00Z`); const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day); const y=d.getUTCFullYear(); const start=new Date(Date.UTC(y,0,1)); const w=Math.ceil((((d.getTime()-start.getTime())/86400000)+1)/7); return `${y}-W${String(w).padStart(2,"0")}`;}
function weeklyCloses(rows:DailyCandle[]){const by=new Map<string,DailyCandle>(); for(const r of rows){const k=weekKey(r.tradingDate); const prev=by.get(k); if(!prev||r.tradingDate>prev.tradingDate) by.set(k,r);} return [...by.values()].sort((a,b)=>a.tradingDate.localeCompare(b.tradingDate)).map(r=>({date:r.tradingDate, close:r.close}));}
function sortItems(items:MarketWatchItem[]){return items.sort((a,b)=>{const atA=a.signal==="at"?1:0, atB=b.signal==="at"?1:0; if(atA!==atB) return atA-atB; const ma=Math.abs(a.magnitudePct??0), mb=Math.abs(b.magnitudePct??0); if(mb!==ma) return mb-ma; return a.symbol.localeCompare(b.symbol);}).slice(0,LIMIT);}
const empty=(reason:string|null=null):MarketWatchSection=>({available:true,items:[],eligibleSymbols:0,reason});
export function calculateMarketWatchFromCandles(rows:DailyCandle[], configuredSymbols:string[]):MarketWatchResult{
 const by=new Map<string,DailyCandle[]>(); let earliest:string|null=null;
 for(const r of rows){ if(!valid(r)) continue; const s=r.symbol.toUpperCase(); by.set(s,[...(by.get(s)??[]),{...r,symbol:s}]); if(!earliest||r.tradingDate<earliest) earliest=r.tradingDate; }
 for(const arr of by.values()) arr.sort((a,b)=>a.tradingDate.localeCompare(b.tradingDate));
 const asOfDate=[...by.values()].map(a=>a.at(-1)?.tradingDate).filter(Boolean).sort().at(-1)??null;
 const highs:MarketWatchSection=empty(); const lows:MarketWatchSection=empty(); const d200:MarketWatchSection=empty(); const w200:MarketWatchSection=empty(); const stale:string[]=[]; let maxWeeks=0;
 for(const raw of configuredSymbols){const symbol=raw.toUpperCase(); const arr=by.get(symbol)??[]; const latest=arr.at(-1); if(!latest||latest.tradingDate!==asOfDate){stale.push(symbol); continue;}
   const prior=arr.slice(0,-1); if(prior.length>=PRIOR_52W_SESSIONS){const win=prior.slice(-PRIOR_52W_SESSIONS); const prevHi=Math.max(...win.map(r=>r.high)); const prevLo=Math.min(...win.map(r=>r.low)); highs.eligibleSymbols++; lows.eligibleSymbols++; if(latest.high>=prevHi) highs.items.push({symbol,signal:"new_high",latestPrice:latest.high,referenceValue:prevHi,latestTradingDate:latest.tradingDate,magnitudePct:mag(latest.high,prevHi)}); if(latest.low<=prevLo) lows.items.push({symbol,signal:"new_low",latestPrice:latest.low,referenceValue:prevLo,latestTradingDate:latest.tradingDate,magnitudePct:mag(latest.low,prevLo)}); }
   const closes=arr.map(r=>r.close); if(closes.length>=MA_SESSIONS+1){d200.eligibleSymbols++; const prevClose=closes.at(-2)!; const latestClose=closes.at(-1)!; const prevMa=avg(closes.slice(-(MA_SESSIONS+1),-1)); const curMa=avg(closes.slice(-MA_SESSIONS)); const signal:MarketWatchSignal|null=prevClose<prevMa&&latestClose>=curMa?"crossed_above":prevClose>prevMa&&latestClose<=curMa?"crossed_below":roundPrice(latestClose)===roundPrice(curMa)?"at":null; if(signal) d200.items.push({symbol,signal,latestPrice:latestClose,referenceValue:curMa,latestTradingDate:latest.tradingDate,magnitudePct:mag(latestClose,curMa)}); }
   const weeks=weeklyCloses(arr); maxWeeks=Math.max(maxWeeks,weeks.length); if(weeks.length>=MA_SESSIONS+1){w200.eligibleSymbols++; const prevClose=weeks.at(-2)!.close; const latestClose=weeks.at(-1)!.close; const prevMa=avg(weeks.slice(-(MA_SESSIONS+1),-1).map(w=>w.close)); const curMa=avg(weeks.slice(-MA_SESSIONS).map(w=>w.close)); const signal:MarketWatchSignal|null=prevClose<prevMa&&latestClose>=curMa?"crossed_above":prevClose>prevMa&&latestClose<=curMa?"crossed_below":roundPrice(latestClose)===roundPrice(curMa)?"at":null; if(signal) w200.items.push({symbol,signal,latestPrice:latestClose,referenceValue:curMa,latestTradingDate:latest.tradingDate,magnitudePct:mag(latestClose,curMa)}); }
 }
 highs.items=sortItems(highs.items); lows.items=sortItems(lows.items); d200.items=sortItems(d200.items); w200.items=sortItems(w200.items); if(w200.eligibleSymbols===0) {w200.available=false; w200.reason=`Insufficient history: max ${maxWeeks} complete weekly observations available; 201 required.`;}
 return {asOfDate,highs52Week:highs,lows52Week:lows,crosses200Day:d200,crosses200Week:w200,coverage:{configuredSymbols:configuredSymbols.length,staleSymbols:stale,earliestTradingDate:earliest,maxWeeklyObservations:maxWeeks,staleDateRule:"A symbol is stale when its latest valid candle date differs from the latest valid S&P 500 candle date in the snapshot build."}};
}
