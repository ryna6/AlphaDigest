import { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/api/responses";
import { mockMeta } from "@/lib/data/fixtures/dashboard";
import { genericPayloadSchema } from "@/lib/data/schemas/dashboard";

export function GET(_request: NextRequest, { params }: { params: { symbol: string } }){
  const symbol = params.symbol.toUpperCase();
  return jsonResponse(genericPayloadSchema,{meta:{...mockMeta,source:`${symbol} fixture snapshot`},message:`${symbol} is using mock ticker data. Live quote, OHLC, flow, and ownership adapters are pending.`,rows:[{symbol,price:"$211.08",change:"+0.7%"}]});
}
