import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { listDashboardSnapshotStatus } from "@/lib/data/adapters/dashboard-snapshots";

export const dynamic = "force-dynamic";

const CACHE_TABLES = [
  "data_refresh_metadata",
  "dashboard_snapshots",
  "investing_economic_events",
  "market_quotes",
  "unusual_whales_earnings_events",
  "unusual_whales_featured_articles",
  "unusual_whales_news_feed",
  "cboe_put_call_intraday"
] as const;

async function tableCount(client: any, table: string) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  return { table, count: count ?? null, ok: !error, error: error?.message };
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const snapshots = await listDashboardSnapshotStatus();
  if (!supabase.ok) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      supabase: { configured: false, message: supabase.message },
      snapshots: snapshots.snapshots,
      tableCounts: [],
      metadata: []
    });
  }

  const [counts, metadataResult] = await Promise.all([
    Promise.all(CACHE_TABLES.map((table) => tableCount(supabase.client, table))),
    supabase.client
      .from("data_refresh_metadata")
      .select("source,ok,fetched_at,changed,row_count,content_hash,error,meta")
      .order("fetched_at", { ascending: false })
      .limit(20)
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    supabase: { configured: true },
    snapshots: snapshots.snapshots,
    tableCounts: counts,
    metadata: metadataResult.error ? [] : metadataResult.data,
    metadataError: metadataResult.error?.message
  });
}
