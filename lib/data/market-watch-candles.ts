import type { DailyCandle } from "./daily-candles";

export const MARKET_WATCH_DISTANCE_THRESHOLD_PCT = 2;
export const MARKET_WATCH_STALE_TOLERANCE_SESSIONS = 0;

export type MarketWatchPosition = "above" | "below" | "at";
export type MarketWatchItem = { symbol: string; latestClose: number; referenceValue: number; distancePct: number; position: MarketWatchPosition; latestTradingDate: string };
export type MarketWatchSection = { available: boolean; items: MarketWatchItem[]; eligibleSymbols: number; reason: string | null };
export type MarketWatch = { asOfDate: string | null; thresholdPct: number; coverage: { earliestTradingDate: string | null; latestTradingDate: string | null; symbols: number; maxDailyRowsPerSymbol: number; maxWeeklyClosesPerSymbol: number }; near52WeekHigh: MarketWatchSection; near52WeekLow: MarketWatchSection; near200DayMa: MarketWatchSection; near200WeekMa: MarketWatchSection };

const emptySection = (reason: string | null = null): MarketWatchSection => ({ available: !reason, items: [], eligibleSymbols: 0, reason });
const valid = (r: DailyCandle) => [r.open, r.high, r.low, r.close].every((n) => Number.isFinite(n) && n > 0) && r.high >= Math.max(r.open, r.close) && r.low <= Math.min(r.open, r.close) && r.high >= r.low && /^\d{4}-\d{2}-\d{2}$/.test(r.tradingDate);
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const pos = (distance: number): MarketWatchPosition => Math.abs(distance) < 0.005 ? "at" : distance > 0 ? "above" : "below";
function pushSorted(items: MarketWatchItem[], item: MarketWatchItem, threshold = MARKET_WATCH_DISTANCE_THRESHOLD_PCT) { if (Math.abs(item.distancePct) <= threshold) items.push(item); }
function isoWeekKey(date: string) { const d = new Date(`${date}T00:00:00Z`); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }
export function weeklyClosesFromDaily(rows: DailyCandle[]) { const byWeek = new Map<string, DailyCandle>(); for (const row of rows.filter(valid).sort((a,b)=>a.tradingDate.localeCompare(b.tradingDate))) byWeek.set(isoWeekKey(row.tradingDate), row); return [...byWeek.values()].map((r) => ({ tradingDate: r.tradingDate, close: r.close })); }
const finalize = (items: MarketWatchItem[]) => items.sort((a,b) => Math.abs(a.distancePct) - Math.abs(b.distancePct) || a.symbol.localeCompare(b.symbol)).slice(0, 5);

export function calculateMarketWatchFromCandles(rows: DailyCandle[], symbols: string[]): MarketWatch {
  const cleaned = rows.filter(valid);
  const dates = cleaned.map((r) => r.tradingDate).sort();
  const latestMarketDate = dates.at(-1) ?? null;
  const bySymbol = new Map<string, DailyCandle[]>();
  for (const row of cleaned) if (symbols.includes(row.symbol)) bySymbol.set(row.symbol, [...(bySymbol.get(row.symbol) ?? []), row]);
  const highItems: MarketWatchItem[] = [], lowItems: MarketWatchItem[] = [], ma200Items: MarketWatchItem[] = [], ma200wItems: MarketWatchItem[] = [];
  let eligHigh = 0, eligLow = 0, elig200 = 0, elig200w = 0, maxDaily = 0, maxWeekly = 0;
  for (const [symbol, rs] of bySymbol) {
    const sorted = rs.sort((a,b)=>a.tradingDate.localeCompare(b.tradingDate));
    maxDaily = Math.max(maxDaily, sorted.length);
    const latest = sorted.at(-1);
    if (!latest || latest.tradingDate !== latestMarketDate) continue;
    const latestClose = latest.close;
    const high52 = Math.max(...sorted.map((r) => r.high));
    const low52 = Math.min(...sorted.map((r) => r.low));
    if (Number.isFinite(high52) && high52 > 0) { eligHigh++; const distancePct = ((high52 - latestClose) / high52) * 100; if (distancePct >= 0) pushSorted(highItems, { symbol, latestClose, referenceValue: high52, distancePct, position: "below", latestTradingDate: latest.tradingDate }); }
    if (Number.isFinite(low52) && low52 > 0) { eligLow++; const distancePct = ((latestClose - low52) / low52) * 100; if (distancePct >= 0) pushSorted(lowItems, { symbol, latestClose, referenceValue: low52, distancePct, position: "above", latestTradingDate: latest.tradingDate }); }
    const closes = sorted.map((r) => r.close);
    if (closes.length >= 200) { elig200++; const ref = avg(closes.slice(-200)); const distancePct = ((latestClose - ref) / ref) * 100; pushSorted(ma200Items, { symbol, latestClose, referenceValue: ref, distancePct, position: pos(distancePct), latestTradingDate: latest.tradingDate }); }
    const weekly = weeklyClosesFromDaily(sorted); maxWeekly = Math.max(maxWeekly, weekly.length);
    if (weekly.length >= 200) { elig200w++; const ref = avg(weekly.slice(-200).map((w) => w.close)); const distancePct = ((latestClose - ref) / ref) * 100; pushSorted(ma200wItems, { symbol, latestClose, referenceValue: ref, distancePct, position: pos(distancePct), latestTradingDate: latest.tradingDate }); }
  }
  const insufficient200w = elig200w === 0 ? `Insufficient history: true 200W MA requires at least 200 complete weekly closes; current maximum is ${maxWeekly}.` : null;
  return { asOfDate: latestMarketDate, thresholdPct: MARKET_WATCH_DISTANCE_THRESHOLD_PCT, coverage: { earliestTradingDate: dates[0] ?? null, latestTradingDate: latestMarketDate, symbols: bySymbol.size, maxDailyRowsPerSymbol: maxDaily, maxWeeklyClosesPerSymbol: maxWeekly }, near52WeekHigh: { ...emptySection(), items: finalize(highItems), eligibleSymbols: eligHigh }, near52WeekLow: { ...emptySection(), items: finalize(lowItems), eligibleSymbols: eligLow }, near200DayMa: { ...emptySection(elig200 ? null : "Insufficient history: 200 valid daily closes required."), items: finalize(ma200Items), eligibleSymbols: elig200 }, near200WeekMa: { ...emptySection(insufficient200w), items: finalize(ma200wItems), eligibleSymbols: elig200w } };
}
