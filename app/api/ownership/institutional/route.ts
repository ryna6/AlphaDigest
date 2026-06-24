import { NextResponse } from "next/server";
import { getCachedInstitutionalSummary } from "@/lib/data/adapters/unusual-whales-institutional";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getCachedInstitutionalSummary();
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
