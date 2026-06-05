import { NextResponse } from "next/server";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";
import { getProviderAvailability } from "@/lib/data/adapters/market-data-provider-adapter";
import { getEnvironmentStatus } from "@/lib/netlify/env";

export function GET(){return NextResponse.json({mode:"mock",freshness:"degraded",message:"Mock data enabled. Add API keys in Netlify to enable live data.",environment:getEnvironmentStatus(),finnhub:getFinnhubKeyStatus(),providers:getProviderAvailability()},{headers:{"Cache-Control":"no-store"}});}
