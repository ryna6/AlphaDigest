import { createServerSupabaseClient } from "../lib/db/supabase";
import { fetchUnusualWhalesFuturesPayload, parseUnusualWhalesFuturesCandles, verifyFuturesStoredRows, pruneOlderSp500FuturesRows } from "../lib/data/unusual-whales-futures-candles";
import { upsertDailyCandles } from "../lib/data/daily-candles";
async function main(){
  const supabase = createServerSupabaseClient(); if(!supabase.ok) throw new Error(supabase.message);
  const { error } = await supabase.client.from("market_daily_candles").select("symbol,provider_symbol,trading_date,open,high,low,close,volume,previous_close,source,source_timestamp,fetched_at").limit(0);
  if(error) throw new Error(`market_daily_candles unavailable: ${error.message}`);
  const fetched = await fetchUnusualWhalesFuturesPayload();
  const parsed = parseUnusualWhalesFuturesCandles(fetched.payload);
  const up = await upsertDailyCandles("market_daily_candles", parsed.candles, supabase.client);
  if(parsed.candles[0]) await pruneOlderSp500FuturesRows(parsed.candles[0].tradingDate, supabase.client);
  const verify = await verifyFuturesStoredRows(supabase.client);
  if(!verify.rowCount) throw new Error("Post-upsert verification found zero ES=F rows");
  console.log({ url:fetched.url, httpStatus:fetched.status, arrayPath:parsed.arrayPath, rawRows:parsed.rawCount, validRows:parsed.parsedCount, retainedOneYearRows:parsed.retainedCount, skippedRows:parsed.skippedCount, saturdayRowsSkipped:parsed.saturdayRowsSkipped, upsertedRows:up.upserted, storedRowCount:verify.rowCount, earliestStoredDate:verify.earliestStoredDate, latestStoredDate:verify.latestStoredDate, sundayRowsStored:verify.sundayRows, saturdayRowsStored:verify.saturdayRows, nullVolumeRows:verify.nullVolumeRows, duplicateCount:verify.duplicateCount });
  if(verify.saturdayRows !== 0 || verify.duplicateCount !== 0) process.exit(1);
}
main().catch(e=>{ console.error(e.message); process.exit(1); });
