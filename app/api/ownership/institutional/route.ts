import { NextResponse } from "next/server";
import {
  getCachedInstitutionalSummary,
  getCachedTrackedInstitutions
} from "@/lib/data/adapters/unusual-whales-institutional";

export const dynamic = "force-dynamic";

export async function GET() {
  const [summary, tracked] = await Promise.all([
    getCachedInstitutionalSummary(),
    getCachedTrackedInstitutions()
  ]);
  return NextResponse.json({ ...summary, tracked }, { headers: { "cache-control": "no-store" } });
}
