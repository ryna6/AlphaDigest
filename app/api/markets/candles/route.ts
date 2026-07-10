import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { candleApiPayloadSchema, getSp500CandleUniverse, readCandlesForApi, type CandleRange } from "@/lib/data/daily-candles";
import { normalizeAppSymbol, resolveConfiguredCryptoCandleAsset, resolveConfiguredFixedCandleAsset, resolveSp500CandleAsset } from "@/lib/data/market-assets";

const querySchema = z.object({ symbol: z.string().min(1).max(16), range: z.enum(["1D","1W","1M","3M","YTD","1Y"]).default("1D") });
const envelopeSchema = z.object({ payload: candleApiPayloadSchema, mode: z.enum(["cached","unavailable","error"]), notices: z.array(z.string()), generatedAt: z.string(), timezone: z.string() });
const REAL_CACHE = "public, s-maxage=300, stale-while-revalidate=900";
const NO_STORE = "no-store";
export const dynamic = "force-dynamic";

async function resolveCandleAsset(symbol: string) {
  const crypto = resolveConfiguredCryptoCandleAsset(symbol);
  if (crypto) return crypto;
  const fixed = resolveConfiguredFixedCandleAsset(symbol);
  if (fixed) return fixed;
  const sp500 = await getSp500CandleUniverse();
  return resolveSp500CandleAsset(symbol, sp500);
}

function unavailable(symbol: string, range: CandleRange, notice: string, status = 404) {
  const payload = candleApiPayloadSchema.parse({ symbol: normalizeAppSymbol(symbol), range, table:"market_daily_candles", available:false, candles:[], metadata:{ source:null, earliestTradingDate:null, latestTradingDate:null, fetchedAt:null, rows:0, label:"Unsupported symbol", providerSymbol:null } });
  return NextResponse.json(envelopeSchema.parse({ payload, mode:"unavailable", notices:[notice], generatedAt:new Date().toISOString(), timezone:"America/Toronto" }), { status, headers:{ "Cache-Control":NO_STORE } });
}

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error:"Invalid candle query", issues: parsed.error.flatten() }, { status:400, headers:{ "Cache-Control":NO_STORE } });
  const { symbol, range } = parsed.data;
  try {
    const configured = await resolveCandleAsset(symbol);
    if (!configured) return unavailable(symbol, range, "Symbol is not configured for market candles.");
    const rows = await readCandlesForApi(configured.table, configured.asset.symbol, range);
    const latest = rows.at(-1) as any;
    const earliest = rows[0] as any;
    const candles = rows.map((r:any)=>({ date:r.trading_date, open:Number(r.open), high:Number(r.high), low:Number(r.low), close:Number(r.close), volume:r.volume == null ? null : Number(r.volume), previousClose:r.previous_close == null ? null : Number(r.previous_close) }));
    const payload = candleApiPayloadSchema.parse({ symbol: configured.asset.symbol, range, table: configured.table, available: candles.length > 0, candles, metadata:{ source: latest?.source ?? null, earliestTradingDate: earliest?.trading_date ?? null, latestTradingDate: latest?.trading_date ?? null, fetchedAt: latest?.fetched_at ?? null, rows: candles.length, label: configured.asset.label, providerSymbol: configured.asset.unusualWhalesSymbol ?? configured.asset.finnhubSymbol ?? configured.asset.symbol } });
    const envelope = envelopeSchema.parse({ payload, mode: candles.length ? "cached" : "unavailable", notices: candles.length ? [] : ["No cached candle history is available for this symbol."], generatedAt:new Date().toISOString(), timezone:"America/Toronto" });
    return NextResponse.json(envelope, { headers:{ "Cache-Control": candles.length ? REAL_CACHE : NO_STORE } });
  } catch (e) {
    const payload = candleApiPayloadSchema.parse({ symbol: normalizeAppSymbol(symbol), range, table:"market_daily_candles", available:false, candles:[], metadata:{ source:null, earliestTradingDate:null, latestTradingDate:null, fetchedAt:null, rows:0, label:normalizeAppSymbol(symbol), providerSymbol:null } });
    return NextResponse.json(envelopeSchema.parse({ payload, mode:"error", notices:[(e as Error).message.slice(0,240)], generatedAt:new Date().toISOString(), timezone:"America/Toronto" }), { status:500, headers:{ "Cache-Control":NO_STORE } });
  }
}
