import { getDailyCandleFinnhubKeys } from "./adapters/finnhub-key-router";
import { getSp500CandleUniverse, normalizeFinnhubQuote, normalizeUnusualWhalesCandles, pruneDailyCandles, upsertDailyCandles, oneYearCutoff } from "./daily-candles";
import { cryptoCandleAssets, marketCandleAssets } from "./market-assets";
import { refreshDashboardSnapshot } from "./live-dashboard";

const sleep = (ms:number) => new Promise(r=>setTimeout(r, ms));
async function fetchFinnhubQuotePaced(symbol:string, key:string) { const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`, { cache:"no-store" }); if (res.status === 429) { const ra=Number(res.headers.get("retry-after") ?? 0); if (ra) await sleep(ra*1000); throw new Error("Finnhub rate limited"); } if (!res.ok) throw new Error(`Finnhub ${res.status}`); return res.json(); }
export async function refreshDailyMarketCandles() {
  const keys = getDailyCandleFinnhubKeys(); if (!keys.length) throw new Error("No Finnhub keys configured for daily candle ingestion.");
  const sp500 = await getSp500CandleUniverse();
  const market = marketCandleAssets.filter(a=>a.chartAvailable && a.finnhubSymbol);
  const jobs = [...sp500.map(symbol=>({ table:"sp500_daily_candles" as const, symbol, providerSymbol:symbol.replace(/-/g,".") })), ...market.map(a=>({ table:"market_daily_candles" as const, symbol:a.symbol, providerSymbol:a.finnhubSymbol!, assetGroup:a.group }))];
  let success=0, failed=0, upserted=0; const failures:string[]=[];
  await Promise.all(keys.map(async (lane, laneIndex) => {
    for (let i=laneIndex; i<jobs.length; i+=keys.length) { const job=jobs[i]; await sleep(2100); try { const q=await fetchFinnhubQuotePaced(job.providerSymbol, lane.key); const c=normalizeFinnhubQuote(job.symbol, job.providerSymbol, q); c.assetGroup=(job as any).assetGroup; const r=await upsertDailyCandles(job.table, [c]); upserted+=r.upserted; success++; } catch(e) { failed++; failures.push(`${job.symbol}: lane ${laneIndex+1} ${(e as Error).message}`); } }
  }));
  const cutoff = oneYearCutoff(); const pruned = (await pruneDailyCandles("sp500_daily_candles", cutoff)) + (await pruneDailyCandles("market_daily_candles", cutoff));
  const snapshot = await refreshDashboardSnapshot("markets:latest");
  return { configuredSymbols: jobs.length, attemptedSymbols: jobs.length, successfulSymbols: success, failedSymbols: failed, rowsUpserted: upserted, rowsPruned: pruned, distinctFinnhubKeys: keys.length, effectiveMaxCallsPerMinute: keys.length * 30, failures: failures.slice(0,20), snapshot };
}
export async function refreshCryptoDailyCandles() {
  const token = process.env.UNUSUAL_WHALES_API_KEY; if (!token) throw new Error("UNUSUAL_WHALES_API_KEY missing");
  const start = oneYearCutoff(new Date(Date.now() - 7*86400_000)); let upserted=0, failed=0;
  for (const asset of cryptoCandleAssets) { try { const res=await fetch(`https://phx.unusualwhales.com/api/crypto_candles/${encodeURIComponent(asset.unusualWhalesSymbol!)}/1d/${start}`, { cache:"no-store", headers:{ Authorization:`Bearer ${token}`, accept:"application/json" } }); if (!res.ok) throw new Error(`UW crypto ${res.status}`); const candles=normalizeUnusualWhalesCandles(asset.symbol, asset.unusualWhalesSymbol!, await res.json(), "Unusual Whales Crypto"); upserted += (await upsertDailyCandles("crypto_daily_candles", candles)).upserted; } catch { failed++; } }
  const rowsPruned = await pruneDailyCandles("crypto_daily_candles"); return { configuredSymbols: cryptoCandleAssets.length, successfulSymbols: cryptoCandleAssets.length - failed, failedSymbols: failed, rowsUpserted: upserted, rowsPruned };
}
