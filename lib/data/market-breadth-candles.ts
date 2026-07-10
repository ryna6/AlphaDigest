import type { Metric } from "./schemas/common";
import type { DailyCandle } from "./daily-candles";

export type BreadthCoverage = { latestTradingDate:string|null; participation:{eligible:number; configured:number}; advDecl:{eligible:number; configured:number}; sma50:{eligible:number; configured:number}; sma200:{eligible:number; configured:number}; week52:{eligible:number; configured:number}; staleSymbols:string[] };
export type CandleBreadthResult = { metrics: Metric[]; coverage: BreadthCoverage; warning?: string };
const TOL = 1e-8;
function pct(n:number,d:number){return d ? `${((n/d)*100).toFixed(1)}%` : "—";}
export function calculateMarketBreadthFromCandles(rows: DailyCandle[], configuredSymbols: string[], indexChangePercent: number|null): CandleBreadthResult {
  const by = new Map<string, DailyCandle[]>();
  for (const r of rows) by.set(r.symbol, [...(by.get(r.symbol)??[]), r]);
  for (const arr of by.values()) arr.sort((a,b)=>a.tradingDate.localeCompare(b.tradingDate));
  const latestTradingDate = [...by.values()].flat().map(r=>r.tradingDate).sort().at(-1) ?? null;
  let adv=0, dec=0, unchanged=0, above50=0, elig50=0, above200=0, elig200=0, hi52=0, lo52=0, elig52=0, partElig=0, same=0; const stale:string[]=[];
  const direction = indexChangePercent == null || Math.abs(indexChangePercent) < 0.005 ? 0 : indexChangePercent > 0 ? 1 : -1;
  for (const symbol of configuredSymbols) {
    const arr = by.get(symbol) ?? [];
    const latest = arr.at(-1); if (!latest) { stale.push(symbol); continue; }
    if (latestTradingDate && latest.tradingDate !== latestTradingDate) stale.push(symbol);
    const prev = arr.length >= 2 ? arr.at(-2)! : null;
    if (prev) { partElig++; if (latest.close > prev.close) adv++; else if (latest.close < prev.close) dec++; else unchanged++; if (direction > 0 && latest.close > prev.close) same++; if (direction < 0 && latest.close < prev.close) same++; }
    const closes = arr.map(r=>r.close).filter(Number.isFinite);
    if (closes.length >= 50) { elig50++; const s=closes.slice(-50).reduce((a,b)=>a+b,0)/50; if (latest.close > s) above50++; }
    if (closes.length >= 200) { elig200++; const s=closes.slice(-200).reduce((a,b)=>a+b,0)/200; if (latest.close > s) above200++; }
    if (arr.length >= 200) { elig52++; const window=arr.slice(-253); const max=Math.max(...window.map(r=>r.high)); const min=Math.min(...window.map(r=>r.low)); if (Math.abs(latest.high - max) <= TOL) hi52++; if (Math.abs(latest.low - min) <= TOL) lo52++; }
  }
  const configured = configuredSymbols.length;
  const coverage = { latestTradingDate, participation:{eligible:partElig, configured}, advDecl:{eligible:partElig, configured}, sma50:{eligible:elig50, configured}, sma200:{eligible:elig200, configured}, week52:{eligible:elig52, configured}, staleSymbols:stale };
  const metrics: Metric[] = [
    { label:"Participation", value: direction === 0 ? "—" : pct(same, partElig), subtext: direction === 0 ? "Index unchanged; participation not shown" : `${same}/${partElig} same direction`, tone:"neutral" },
    { label:"Advancers / Decliners", value: partElig ? `${adv.toLocaleString()} / ${dec.toLocaleString()}` : "—", subtext: unchanged ? `${unchanged} unchanged` : "Close vs previous close", tone: adv >= dec ? "positive" : "negative" },
    { label:"% Above 50D MA", value: pct(above50, elig50), subtext: `${above50}/${elig50} eligible`, tone:"neutral" },
    { label:"% Above 200D MA", value: pct(above200, elig200), subtext: `${above200}/${elig200} eligible`, tone:"neutral" },
    { label:"New 52W Highs / Lows", value: elig52 ? `${hi52} / ${lo52}` : "—", subtext: `${elig52}/${configured} eligible`, tone: hi52 >= lo52 ? "positive" : "negative" }
  ];
  const warning = configured && partElig / configured < 0.8 ? `Market Breadth coverage below 80% (${partElig}/${configured}).` : undefined;
  return { metrics, coverage, warning };
}
