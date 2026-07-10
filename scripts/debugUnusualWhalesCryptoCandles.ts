#!/usr/bin/env tsx
import { cryptoCandleEndpointAssets, fetchUnusualWhalesCryptoCandles } from "../lib/data/unusual-whales-crypto-candles";
import { locateUnusualWhalesCandleArray, normalizeUnusualWhalesCandlesWithDiagnostics } from "../lib/data/daily-candles";
const arg = process.argv.find((a)=>a.startsWith("--symbol="))?.split("=")[1]?.toUpperCase();
const assets = arg ? cryptoCandleEndpointAssets.filter((a)=>a.symbol===arg || a.providerSymbol===arg) : cryptoCandleEndpointAssets;
if (!assets.length) throw new Error(`Unknown crypto symbol ${arg}`);
async function main() {
for (const asset of assets) {
  const result = await fetchUnusualWhalesCryptoCandles(asset.symbol, asset.providerSymbol);
  const base: Record<string, unknown> = { applicationSymbol:asset.symbol, providerSymbol:asset.providerSymbol, requestedUrl:result.url, httpStatus:result.status ?? null };
  if (!result.ok) { console.log(JSON.stringify({ ...base, ok:false, stage:result.stage, error:result.error, diagnostics:result.diagnostics }, null, 2)); continue; }
  console.log(JSON.stringify({ ...base, ok:true, finalUrl:result.diagnostics.finalUrl, contentType:result.diagnostics.contentType, responseByteLength:result.diagnostics.responseLength, topLevelResponseType:result.diagnostics.topLevelType, topLevelObjectKeys:result.diagnostics.topLevelKeys, locatedCandleArrayPath:result.diagnostics.arrayPath, rawRowCount:result.rawCount, parsedRowCount:result.parsedCount, skippedRowCount:result.skippedCount, earliestParsedDate:result.candles[0]?.tradingDate ?? null, latestParsedDate:result.candles.at(-1)?.tradingDate ?? null, firstRowKeys:Object.keys(result.candles[0] ?? {}) }, null, 2));
}
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
export { locateUnusualWhalesCandleArray, normalizeUnusualWhalesCandlesWithDiagnostics };
