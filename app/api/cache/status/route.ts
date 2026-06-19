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
  "put_call_observations"
] as const;

const EXPECTED_SNAPSHOT_KEYS = ["today:latest", "markets:latest", "news-calendar:latest"];

async function tableCount(client: any, table: string) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  return { table, count: count ?? null, ok: !error, error: error?.message };
}

async function payloadSize(client: any, key: string) {
  const { data, error } = await client.from("dashboard_snapshots").select("payload").eq("key", key).maybeSingle();
  if (error || !data) return { key, payloadBytes: null, error: error?.message };
  return { key, payloadBytes: Buffer.byteLength(JSON.stringify(data.payload), "utf8") };
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const snapshots = await listDashboardSnapshotStatus();
  const snapshotKeys = snapshots.snapshots.map((snapshot: { key?: string }) => snapshot.key).filter((key): key is string => typeof key === "string");
  const missingSnapshotKeys = EXPECTED_SNAPSHOT_KEYS.filter((key) => !snapshotKeys.includes(key));

  if (!supabase.ok) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      supabase: { configured: false, message: supabase.message },
      expectedSnapshotKeys: EXPECTED_SNAPSHOT_KEYS,
      missingSnapshotKeys,
      snapshots: snapshots.snapshots,
      snapshotPayloadSizes: [],
      tableCounts: [],
      metadata: []
    });
  }

  const [counts, metadataResult, sizes] = await Promise.all([
    Promise.all(CACHE_TABLES.map((table) => tableCount(supabase.client, table))),
    supabase.client
      .from("data_refresh_metadata")
      .select("source,ok,fetched_at,changed,row_count,content_hash,error,meta")
      .order("fetched_at", { ascending: false })
      .limit(30),
    Promise.all(snapshotKeys.map((key) => payloadSize(supabase.client, key)))
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    supabase: { configured: true },
    expectedSnapshotKeys: EXPECTED_SNAPSHOT_KEYS,
    missingSnapshotKeys,
    snapshots: snapshots.snapshots,
    snapshotPayloadSizes: sizes,
    tableCounts: counts,
    metadata: metadataResult.error ? [] : metadataResult.data,
    metadataError: metadataResult.error?.message
  });
}
