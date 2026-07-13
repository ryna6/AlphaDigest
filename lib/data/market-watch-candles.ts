import type { DailyCandle } from "./daily-candles";
import type { MarketWatchItem, MarketWatchPayload, MarketWatchSection } from "./schemas/dashboard";

export const MARKET_WATCH_PRICE_TOLERANCE = 0.005;
const PRIOR_52W_SESSIONS = 252;
const MA_PERIOD = 200;
const MAX_ROWS = 5;

export type MarketWatchCoverage = {
  configuredSymbols: number;
  eligibleSymbols: number;
  staleSymbols: string[];
  latestTradingDate: string | null;
  earliestTradingDate: string | null;
  latestStoredCandleDate: string | null;
  minDailyRowsPerSymbol: number;
  maxDailyRowsPerSymbol: number;
  maxWeeklyClosesPerSymbol: number;
  retentionCutoff: string | null;
};

export type MarketWatchCalculationResult = {
  marketWatch: MarketWatchPayload;
  coverage: MarketWatchCoverage;
  warnings: string[];
};

const unavailableSection = (reason: string): MarketWatchSection => ({ available: false, items: [], eligibleSymbols: 0, reason });
const availableSection = (items: MarketWatchItem[], eligibleSymbols: number): MarketWatchSection => ({ available: true, items: items.slice(0, MAX_ROWS), eligibleSymbols, reason: null });

export function isAtPriceLevel(price: number, reference: number) {
  return Math.abs(Number(price.toFixed(2)) - Number(reference.toFixed(2))) <= MARKET_WATCH_PRICE_TOLERANCE || Math.abs(price - reference) <= 1e-8;
}

function validOhlc(row: DailyCandle) {
  return [row.open, row.high, row.low, row.close].every((n) => Number.isFinite(n) && n > 0) && row.high >= row.open && row.high >= row.close && row.low <= row.open && row.low <= row.close && row.high >= row.low;
}
function avg(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function pct(numerator: number, denominator: number) { return denominator > 0 ? (numerator / denominator) * 100 : null; }
function isoWeekKey(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}
export function weeklyClosesFromDailyCandles(candles: DailyCandle[]) {
  const weeks = new Map<string, { tradingDate: string; close: number }>();
  for (const row of candles) {
    if (!validOhlc(row)) continue;
    const key = isoWeekKey(row.tradingDate);
    const current = weeks.get(key);
    if (!current || row.tradingDate > current.tradingDate) weeks.set(key, { tradingDate: row.tradingDate, close: row.close });
  }
  return [...weeks.values()].sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
}

function emptyPayload(asOfDate: string | null): MarketWatchPayload {
  return { asOfDate, highs52Week: availableSection([], 0), lows52Week: availableSection([], 0), crosses200Day: availableSection([], 0), crosses200Week: unavailableSection("Insufficient history") };
}

export function calculateMarketWatchFromCandles(rows: DailyCandle[], configuredSymbols: string[]): MarketWatchCalculationResult {
  const configured = [...new Set(configuredSymbols.map((s) => s.toUpperCase()))].sort();
  const by = new Map<string, DailyCandle[]>();
  for (const row of rows) if (configured.includes(row.symbol)) by.set(row.symbol, [...(by.get(row.symbol) ?? []), row]);
  const allDates = rows.map((row) => row.tradingDate).sort();
  const latestTradingDate = allDates.at(-1) ?? null;
  const earliestTradingDate = allDates[0] ?? null;
  if (!latestTradingDate) return { marketWatch: emptyPayload(null), coverage: { configuredSymbols: configured.length, eligibleSymbols: 0, staleSymbols: configured, latestTradingDate: null, earliestTradingDate: null, latestStoredCandleDate: null, minDailyRowsPerSymbol: 0, maxDailyRowsPerSymbol: 0, maxWeeklyClosesPerSymbol: 0, retentionCutoff: null }, warnings: ["No S&P 500 candle rows available."] };

  const highs: MarketWatchItem[] = [], lows: MarketWatchItem[] = [], d200: MarketWatchItem[] = [], w200: MarketWatchItem[] = [];
  let elig52 = 0, elig200d = 0, elig200w = 0, eligibleSymbols = 0, maxWeekly = 0;
  const stale: string[] = [], dailyCounts: number[] = [];

  for (const symbol of configured) {
    const raw = (by.get(symbol) ?? []).sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
    const seen = new Set<string>(); let duplicate = false;
    const arr: DailyCandle[] = [];
    for (const row of raw) { if (seen.has(row.tradingDate)) { duplicate = true; continue; } seen.add(row.tradingDate); if (validOhlc(row)) arr.push(row); }
    dailyCounts.push(arr.length);
    const latest = arr.at(-1);
    if (!latest || duplicate || latest.tradingDate !== latestTradingDate) { stale.push(symbol); continue; }
    eligibleSymbols++;
    if (arr.length >= PRIOR_52W_SESSIONS + 1) {
      elig52++;
      const previous = arr.slice(-(PRIOR_52W_SESSIONS + 1), -1);
      const previousHigh = Math.max(...previous.map((r) => r.high));
      const previousLow = Math.min(...previous.map((r) => r.low));
      if (latest.high >= previousHigh) highs.push({ symbol, signal: "new_high", latestPrice: latest.close, referenceValue: previousHigh, previousPrice: latest.high, previousReferenceValue: null, eventDate: latest.tradingDate, magnitudePct: pct(latest.high - previousHigh, previousHigh) });
      if (latest.low <= previousLow) lows.push({ symbol, signal: "new_low", latestPrice: latest.close, referenceValue: previousLow, previousPrice: latest.low, previousReferenceValue: null, eventDate: latest.tradingDate, magnitudePct: pct(previousLow - latest.low, previousLow) });
    }
    const closes = arr.map((r) => r.close);
    if (closes.length >= MA_PERIOD + 1) {
      elig200d++;
      const previousClose = closes.at(-2)!; const latestClose = closes.at(-1)!;
      const previousMa = avg(closes.slice(-(MA_PERIOD + 1), -1));
      const currentMa = avg(closes.slice(-MA_PERIOD));
      const signal = previousClose < previousMa && latestClose >= currentMa ? "crossed_above" : previousClose > previousMa && latestClose <= currentMa ? "crossed_below" : isAtPriceLevel(latestClose, currentMa) ? "at" : null;
      if (signal) d200.push({ symbol, signal, latestPrice: latestClose, referenceValue: currentMa, previousPrice: previousClose, previousReferenceValue: previousMa, eventDate: latest.tradingDate, magnitudePct: pct(Math.abs(latestClose - currentMa), currentMa) });
    }
    const weekly = weeklyClosesFromDailyCandles(arr); maxWeekly = Math.max(maxWeekly, weekly.length);
    if (weekly.length >= MA_PERIOD + 1) {
      elig200w++;
      const closesW = weekly.map((r) => r.close); const previousClose = closesW.at(-2)!; const latestClose = closesW.at(-1)!;
      const previousMa = avg(closesW.slice(-(MA_PERIOD + 1), -1)); const currentMa = avg(closesW.slice(-MA_PERIOD));
      const signal = previousClose < previousMa && latestClose >= currentMa ? "crossed_above" : previousClose > previousMa && latestClose <= currentMa ? "crossed_below" : isAtPriceLevel(latestClose, currentMa) ? "at" : null;
      if (signal) w200.push({ symbol, signal, latestPrice: latestClose, referenceValue: currentMa, previousPrice: previousClose, previousReferenceValue: previousMa, eventDate: weekly.at(-1)!.tradingDate, magnitudePct: pct(Math.abs(latestClose - currentMa), currentMa) });
    }
  }
  const sortBreakout = (a: MarketWatchItem, b: MarketWatchItem) => (b.magnitudePct ?? 0) - (a.magnitudePct ?? 0) || a.symbol.localeCompare(b.symbol);
  const sortCross = (a: MarketWatchItem, b: MarketWatchItem) => (a.signal === "at" ? 1 : 0) - (b.signal === "at" ? 1 : 0) || (b.magnitudePct ?? 0) - (a.magnitudePct ?? 0) || a.symbol.localeCompare(b.symbol);
  const weeklyReason = elig200w ? null : "Insufficient history";
  const marketWatch = { asOfDate: latestTradingDate, highs52Week: availableSection(highs.sort(sortBreakout), elig52), lows52Week: availableSection(lows.sort(sortBreakout), elig52), crosses200Day: availableSection(d200.sort(sortCross), elig200d), crosses200Week: weeklyReason ? { ...unavailableSection(weeklyReason), eligibleSymbols: elig200w } : availableSection(w200.sort(sortCross), elig200w) } satisfies MarketWatchPayload;
  return { marketWatch, coverage: { configuredSymbols: configured.length, eligibleSymbols, staleSymbols: stale.sort(), latestTradingDate, earliestTradingDate, latestStoredCandleDate: latestTradingDate, minDailyRowsPerSymbol: dailyCounts.length ? Math.min(...dailyCounts) : 0, maxDailyRowsPerSymbol: dailyCounts.length ? Math.max(...dailyCounts) : 0, maxWeeklyClosesPerSymbol: maxWeekly, retentionCutoff: earliestTradingDate }, warnings: weeklyReason ? [weeklyReason] : [] };
}
