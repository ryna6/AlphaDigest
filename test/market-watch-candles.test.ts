import assert from "node:assert/strict";
import test from "node:test";
import { calculateMarketWatchFromCandles, MARKET_WATCH_DISTANCE_THRESHOLD_PCT, weeklyClosesFromDaily } from "../lib/data/market-watch-candles";
import type { DailyCandle } from "../lib/data/daily-candles";
const row = (symbol:string, date:string, close:number, high=close, low=close): DailyCandle => ({ symbol, providerSymbol:symbol, tradingDate:date, open:close, high, low, close, volume:null, previousClose:null, source:"test", sourceTimestamp:null, fetchedAt:"now" });
const days = (symbol:string, count:number, start="2024-01-01", close=(i:number)=>100): DailyCandle[] => Array.from({length:count},(_,i)=>{ const d=new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+i); const c=close(i); return row(symbol,d.toISOString().slice(0,10),c,c,c); });
test("calculates 52W high/low threshold, sorting, stale and invalid exclusions", () => {
  const rows=[...days("AAA", 10, "2024-01-01", i=>i===9?98:100), row("BBB","2024-01-10",102,102,100), row("CCC","2024-01-09",100), row("BAD","2024-01-10",-1)];
  const w=calculateMarketWatchFromCandles(rows,["AAA","BBB","CCC","BAD"]);
  assert.equal(w.thresholdPct, MARKET_WATCH_DISTANCE_THRESHOLD_PCT);
  assert.equal(w.asOfDate,"2024-01-10");
  assert.equal(w.near52WeekHigh.items[0].symbol,"BBB");
  assert.equal(w.near52WeekLow.items.some(i=>i.symbol==="CCC"),false);
});
test("calculates exactly 200 daily observations and above/below labels", () => {
  const rows=[...days("AAA",199,"2024-01-01",()=>100),...days("BBB",200,"2024-01-01",i=>i===199?102:100),...days("CCC",200,"2024-01-01",i=>i===199?98:100)];
  const w=calculateMarketWatchFromCandles(rows,["AAA","BBB","CCC"]);
  assert.equal(w.near200DayMa.eligibleSymbols,2);
  assert.equal(w.near200DayMa.items.find(i=>i.symbol==="BBB")?.position,"above");
  assert.equal(w.near200DayMa.items.find(i=>i.symbol==="CCC")?.position,"below");
});
test("aggregates true weekly closes including holiday-shortened weeks and does not fabricate 200W", () => {
  const short=[row("AAA","2024-07-01",100),row("AAA","2024-07-03",101),row("AAA","2024-07-05",102)];
  assert.equal(weeklyClosesFromDaily(short)[0].tradingDate,"2024-07-05");
  const insufficient=calculateMarketWatchFromCandles(days("AAA",250),["AAA"]);
  assert.equal(insufficient.near200WeekMa.available,false);
  assert.match(insufficient.near200WeekMa.reason ?? "", /200 complete weekly closes/);
});
test("limits to five rows and uses ticker as stable secondary sort", () => {
  const symbols=["FFF","EEE","DDD","CCC","BBB","AAA"];
  const rows=symbols.flatMap(s=>days(s,200,"2024-01-01",()=>100));
  const w=calculateMarketWatchFromCandles(rows,symbols);
  assert.deepEqual(w.near200DayMa.items.map(i=>i.symbol),["AAA","BBB","CCC","DDD","EEE"]);
});
