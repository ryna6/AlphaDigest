import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { candleApiPayloadSchema, readCandlesForApi, getSp500CandleUniverse } from "@/lib/data/daily-candles";
import { findConfiguredCandleAsset } from "@/lib/data/market-assets";

const querySchema = z.object({ symbol: z.string().min(1).max(16), range: z.enum(["1D","1W","1M","3M","YTD","1Y"]).default("1D") });
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error:"Invalid candle query", issues: parsed.error.flatten() }, { status:400 });
  const sp500 = await getSp500CandleUniverse();
  const configured = findConfiguredCandleAsset(parsed.data.symbol, sp500);
  if (!configured) return NextResponse.json({ payload:{ symbol: parsed.data.symbol.toUpperCase(), range: parsed.data.range, table:"market_daily_candles", available:false, candles:[], metadata:{ source:null, latestTradingDate:null, fetchedAt:null, rows:0, label:"Unsupported symbol" } }, mode:"unavailable", notices:["Symbol is not configured for market candles."], generatedAt:new Date().toISOString(), timezone:"America/Toronto" }, { status:404 });
  const rows = await readCandlesForApi(configured.table, configured.asset.symbol, parsed.data.range);
  const latest = rows.at(-1) as any;
  const payload = candleApiPayloadSchema.parse({ symbol: configured.asset.symbol, range: parsed.data.range, table: configured.table, available: rows.length > 0, candles: rows.map((r:any)=>({ date:r.trading_date, open:Number(r.open), high:Number(r.high), low:Number(r.low), close:Number(r.close), volume:r.volume == null ? null : Number(r.volume), previousClose:r.previous_close == null ? null : Number(r.previous_close) })), metadata:{ source: latest?.source ?? null, latestTradingDate: latest?.trading_date ?? null, fetchedAt: latest?.fetched_at ?? null, rows: rows.length, label: configured.asset.label } });
  return NextResponse.json({ payload, mode: rows.length ? "cached" : "unavailable", notices: rows.length ? [] : ["No cached candle history is available for this symbol."], generatedAt:new Date().toISOString(), timezone:"America/Toronto" }, { headers:{ "Cache-Control":"s-maxage=3600, stale-while-revalidate=86400" } });
}
