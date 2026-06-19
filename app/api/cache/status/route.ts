import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { listDashboardSnapshotStatus } from "@/lib/data/adapters/dashboard-snapshots";

export const dynamic = "force-dynamic";

const EXPECTED_TABLE_COLUMNS = {
  data_refresh_metadata: ["source", "ok", "fetched_at", "changed", "row_count", "content_hash", "error", "meta"],
  investing_economic_events: ["id", "event_name", "event_date", "event_time", "source_url", "content_hash", "fetched_at", "updated_at"],
  market_quotes: ["id", "source", "symbol", "display_symbol", "price", "market_time", "content_hash", "fetched_at", "updated_at"],
  unusual_whales_earnings_events: ["id", "symbol", "report_date", "content_hash", "fetched_at", "updated_at"],
  unusual_whales_featured_articles: ["id", "slug", "title", "published_at", "created_at_source", "source_url", "content_hash", "fetched_at", "updated_at"],
  unusual_whales_news_feed: ["id", "headline", "event_time", "source_url", "content_hash", "fetched_at", "updated_at"],
  put_call_observations: ["external_id", "ratio_type", "value", "equity_ratio", "index_ratio", "total_ratio", "market_date", "as_of_eastern", "source_url", "fetched_at", "updated_at"],
  dashboard_snapshots: ["key", "payload", "mode", "notices", "generated_at", "expires_at", "source_hash", "metadata"]
} as const;

const CACHE_TABLES = Object.keys(EXPECTED_TABLE_COLUMNS) as Array<keyof typeof EXPECTED_TABLE_COLUMNS>;
const EXPECTED_SNAPSHOT_KEYS = ["today:latest", "markets:latest", "news-calendar:latest"];

async function tableCount(client: any, table: string) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  return { table, count: count ?? null, present: !error, ok: !error, error: error?.message };
}

async function columnStatus(client: any, table: keyof typeof EXPECTED_TABLE_COLUMNS) {
  const columns = EXPECTED_TABLE_COLUMNS[table];
  const { error } = await client.from(table).select(columns.join(","), { head: true }).limit(1);
  const message = error?.message ?? null;
  const missing = message
    ? columns.filter((column) => message.includes(`'${column}'`) || message.includes(` ${column} `) || message.includes(column))
    : [];
  return { table, expectedColumns: columns, ok: !error, missingColumns: missing, error: message };
}

async function payloadSize(client: any, key: string) {
  const { data, error } = await client.from("dashboard_snapshots").select("payload").eq("key", key).maybeSingle();
  if (error || !data) return { key, payloadBytes: null, error: error?.message };
  return { key, payloadBytes: Buffer.byteLength(JSON.stringify(data.payload), "utf8") };
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  const supabase = createServerSupabaseClient();
  const snapshots = await listDashboardSnapshotStatus();
  const snapshotKeys = snapshots.snapshots.map((snapshot: { key?: string }) => snapshot.key).filter((key): key is string => typeof key === "string");
  const missingSnapshotKeys = EXPECTED_SNAPSHOT_KEYS.filter((key) => !snapshotKeys.includes(key));

  if (!supabase.ok) {
    return NextResponse.json({
      generatedAt,
      supabase: { configured: false, message: supabase.message },
      expectedTables: CACHE_TABLES,
      expectedSnapshotKeys: EXPECTED_SNAPSHOT_KEYS,
      missingSnapshotKeys,
      snapshots: snapshots.snapshots,
      snapshotPayloadSizes: [],
      tableCounts: [],
      columnChecks: [],
      metadata: [],
      latestMetadataErrors: []
    });
  }

  const [counts, columns, metadataResult, sizes] = await Promise.all([
    Promise.all(CACHE_TABLES.map((table) => tableCount(supabase.client, table))),
    Promise.all(CACHE_TABLES.map((table) => columnStatus(supabase.client, table))),
    supabase.client
      .from("data_refresh_metadata")
      .select("source,ok,fetched_at,changed,row_count,content_hash,error,meta")
      .order("fetched_at", { ascending: false })
      .limit(30),
    Promise.all(EXPECTED_SNAPSHOT_KEYS.map((key) => payloadSize(supabase.client, key)))
  ]);

  const missingTables = counts.filter((table) => !table.present).map((table) => table.table);
  const missingColumns = columns.filter((table) => !table.ok).map((table) => ({ table: table.table, missingColumns: table.missingColumns, error: table.error }));
  const latestMetadataErrors = (metadataResult.data ?? []).filter((row: { ok?: boolean; error?: string | null }) => row.ok === false || row.error);

  return NextResponse.json({
    generatedAt,
    supabase: { configured: true },
    expectedTables: CACHE_TABLES,
    missingTables,
    expectedSnapshotKeys: EXPECTED_SNAPSHOT_KEYS,
    missingSnapshotKeys,
    snapshots: snapshots.snapshots,
    snapshotPayloadSizes: sizes,
    tableCounts: counts,
    columnChecks: columns,
    missingColumns,
    metadata: metadataResult.error ? [] : metadataResult.data,
    latestMetadataErrors,
    metadataError: metadataResult.error?.message
  });
}
