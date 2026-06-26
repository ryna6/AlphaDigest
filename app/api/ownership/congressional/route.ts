import { NextResponse } from "next/server";
import { getCachedCongressionalPortfolios } from "@/lib/data/adapters/unusual-whales-congressional";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getCachedCongressionalPortfolios();
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
