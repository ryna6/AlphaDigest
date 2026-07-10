import { getDailyCandleFinnhubKeys } from "./adapters/finnhub-key-router";
import { getSp500CandleUniverse, normalizeFinnhubQuote, pruneDailyCandles, readCandlesForApi, upsertDailyCandles, oneYearCutoff } from "./daily-candles";
import { cryptoCandleAssets, marketCandleAssets } from "./market-assets";
import { refreshDashboardSnapshot } from "./live-dashboard";
import { cryptoCandleEndpointAssets, fetchUnusualWhalesCryptoCandles, verifyCryptoCandleDatabaseReady } from "./unusual-whales-crypto-candles";

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
  const db = await verifyCryptoCandleDatabaseReady();
  const configuredSymbols = cryptoCandleEndpointAssets.length;
  if (!db.ok) return { ok:false, partial:false, configuredSymbols, attemptedSymbols:0, successfulSymbols:0, failedSymbols:configuredSymbols, rawRowsFetched:0, validRowsParsed:0, rowsSkipped:0, rowsUpserted:0, rowsVerified:0, rowsPruned:0, failures:[{ symbol:"ALL", stage:"database", message:db.error }], perSymbolResults:[], pruneCutoff:null };
  let rawRowsFetched=0, validRowsParsed=0, rowsSkipped=0, rowsUpserted=0, rowsVerified=0, successfulSymbols=0; const failures:any[]=[]; const perSymbolResults:any[]=[];
  for (const asset of cryptoCandleEndpointAssets) {
    console.info("crypto_candle_fetch_started", { symbol:asset.symbol, providerSymbol:asset.providerSymbol });
    const fetched = await fetchUnusualWhalesCryptoCandles(asset.symbol, asset.providerSymbol);
    if (!fetched.ok) { failures.push({ symbol:asset.symbol, providerSymbol:asset.providerSymbol, stage:fetched.stage, message:fetched.error }); perSymbolResults.push({ applicationSymbol:asset.symbol, providerSymbol:asset.providerSymbol, url:fetched.url, httpStatus:fetched.status ?? null, rawRowCount:0, validRowCount:0, skippedRowCount:0, upsertedRowCount:0, verifiedStoredRowCount:0, storedRowsWithVolume:0, earliestStoredDate:null, latestStoredDate:null, failureStage:fetched.stage, failureMessage:fetched.error }); console.warn("crypto_candle_fetch_completed", { symbol:asset.symbol, ok:false, stage:fetched.stage, error:fetched.error }); continue; }
    console.info("crypto_candle_fetch_completed", { symbol:asset.symbol, status:fetched.status, rawCount:fetched.rawCount }); console.info("crypto_candle_parse_completed", { symbol:asset.symbol, parsedCount:fetched.parsedCount, skippedCount:fetched.skippedCount, arrayPath:fetched.diagnostics.arrayPath });
    rawRowsFetched += fetched.rawCount; validRowsParsed += fetched.parsedCount; rowsSkipped += fetched.skippedCount;
    try {
      const up = await upsertDailyCandles("crypto_daily_candles", fetched.candles, db.supabase); rowsUpserted += up.upserted; console.info("crypto_candle_upsert_completed", { symbol:asset.symbol, upserted:up.upserted });
      const stored = await readCandlesForApi("crypto_daily_candles", asset.symbol, "1Y", db.supabase) as any[]; const count = stored.length; const withVolume = stored.filter(r=>r.volume != null).length; const earliest = stored[0]?.trading_date ?? null; const latest = stored.at(-1)?.trading_date ?? null; if (!count) throw new Error("Post-upsert verification found zero stored rows");
      rowsVerified += count; successfulSymbols++; console.info("crypto_candle_verification_completed", { symbol:asset.symbol, count, withVolume, earliest, latest });
      perSymbolResults.push({ applicationSymbol:asset.symbol, providerSymbol:asset.providerSymbol, url:fetched.url, httpStatus:fetched.status, rawRowCount:fetched.rawCount, validRowCount:fetched.parsedCount, skippedRowCount:fetched.skippedCount, upsertedRowCount:up.upserted, verifiedStoredRowCount:count, storedRowsWithVolume:withVolume, earliestStoredDate:earliest, latestStoredDate:latest, failureStage:null, failureMessage:null });
    } catch (e) {
      const msg=(e as Error).message.slice(0,300); failures.push({ symbol:asset.symbol, providerSymbol:asset.providerSymbol, stage:"database", message:msg }); perSymbolResults.push({ applicationSymbol:asset.symbol, providerSymbol:asset.providerSymbol, url:fetched.url, httpStatus:fetched.status, rawRowCount:fetched.rawCount, validRowCount:fetched.parsedCount, skippedRowCount:fetched.skippedCount, upsertedRowCount:0, verifiedStoredRowCount:0, storedRowsWithVolume:0, earliestStoredDate:null, latestStoredDate:null, failureStage:"database", failureMessage:msg });
    }
  }
  const failedSymbols = configuredSymbols - successfulSymbols; let rowsPruned=0; const pruneCutoff = oneYearCutoff(); if (successfulSymbols > 0) rowsPruned = await pruneDailyCandles("crypto_daily_candles", pruneCutoff, db.supabase);
  const ok = successfulSymbols > 0 && rowsUpserted > 0 && rowsVerified > 0; const partial = ok && failedSymbols > 0;
  return { ok, partial, configuredSymbols, attemptedSymbols:configuredSymbols, successfulSymbols, failedSymbols, rawRowsFetched, validRowsParsed, rowsSkipped, rowsUpserted, rowsVerified, rowsPruned, failures, perSymbolResults, pruneCutoff };
}
