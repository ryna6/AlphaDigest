import { fetchUnusualWhalesFuturesPayload, parseUnusualWhalesFuturesCandles, SP500_FUTURES_HISTORY_URL, locateFuturesCandleArray } from "../lib/data/unusual-whales-futures-candles";
async function main(){
  console.log({ requestedUrl: SP500_FUTURES_HISTORY_URL });
  const fetched = await fetchUnusualWhalesFuturesPayload();
  const topLevelType = Array.isArray(fetched.payload) ? "array" : fetched.payload && typeof fetched.payload === "object" ? "object" : typeof fetched.payload;
  const keys = fetched.payload && typeof fetched.payload === "object" && !Array.isArray(fetched.payload) ? Object.keys(fetched.payload as any) : [];
  const located = locateFuturesCandleArray(fetched.payload);
  const first = located.rows[0] as any;
  const parsed = parseUnusualWhalesFuturesCandles(fetched.payload);
  console.log({ httpStatus:fetched.status, finalUrl:fetched.finalUrl, contentType:fetched.contentType, responseByteLength:fetched.byteLength, topLevelType, topLevelObjectKeys:keys, candleArrayPath:located.path, rawRowCount:located.rows.length, firstRowKeys:first && typeof first === "object" ? Object.keys(first) : [], firstRowSummary:first ? { date:first.date, open:first.open, high:first.high, low:first.low, close:first.close } : null, parsedRowCount:parsed.parsedCount, retainedOneYearRowCount:parsed.retainedCount, skippedRowCount:parsed.skippedCount, earliestParsedDate:parsed.allValidCandles[0]?.tradingDate ?? null, latestParsedDate:parsed.allValidCandles.at(-1)?.tradingDate ?? null, sundayRowCount:parsed.allValidCandles.filter(c=>new Date(`${c.tradingDate}T12:00:00Z`).getUTCDay()===0).length, saturdayRowCount:parsed.saturdayRowsSkipped });
}
main().catch(e=>{ console.error(e.message); process.exit(1); });
