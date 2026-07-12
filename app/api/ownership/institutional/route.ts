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
  return NextResponse.json({ ...summary, tracked }, { headers: { "Cache-Control": "no-cache", "CDN-Cache-Control": "s-maxage=900, stale-while-revalidate=21600", "Netlify-CDN-Cache-Control": "public, s-maxage=900, stale-while-revalidate=21600" } });
}
