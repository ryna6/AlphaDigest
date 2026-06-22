import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase";
import { listDashboardSnapshotStatus } from "@/lib/data/adapters/dashboard-snapshots";
import { getStatusRowsWithDiagnostics } from "@/lib/status/jobs";

export const dynamic = "force-dynamic";

const EXPECTED_TABLE_COLUMNS = {
  data_refresh_metadata: ["source", "ok", "fetched_at", "changed", "row_count", "content_hash", "error", "meta"],
  investing_economic_events: ["id", "event_name", "event_date", "event_time", "source_url", "content_hash", "fetched_at", "updated_at"],
  market_quotes: ["id", "source", "symbol", "display_symbol", "price", "market_time", "content_hash", "fetched_at", "updated_at"],
  unusual_whales_earnings_events: ["id", "symbol", "report_date", "content_hash", "fetched_at", "updated_at"],
  unusual_whales_featured_articles: ["id", "slug", "title", "published_at", "created_at_source", "source_url", "content_hash", "fetched_at", "updated_at"],
  unusual_whales_news_feed: ["id", "headline", "event_time", "source_url", "content_hash", "fetched_at", "updated_at"],
  put_call_observations: ["external_id", "ratio_type", "value", "equity_ratio", "index_ratio", "total_ratio", "market_date", "as_of_eastern", "source_url", "fetched_at", "updated_at"],
  unusual_whales_dark_pool_flows: ["external_id", "executed_at", "ticker", "sector", "price", "premium", "size", "volume", "avg30_volume", "fetched_at", "updated_at"],
  unusual_whales_whale_feed: ["external_id", "executed_at", "ticker", "sector", "price", "nbbo_ask", "nbbo_bid", "side", "sentiment", "premium", "size", "volume", "avg30_volume", "fetched_at", "created_at", "updated_at"],
  unusual_whales_insider_trades: ["external_id", "ticker", "sector", "amount", "transaction_date", "price", "owner_name", "officer_title", "transaction_code", "shares_owned_after", "fetched_at", "updated_at"],
  dashboard_snapshots: ["key", "payload", "mode", "notices", "generated_at", "expires_at", "source_hash", "metadata"]
} as const;

const CACHE_TABLES = Object.keys(EXPECTED_TABLE_COLUMNS) as Array<keyof typeof EXPECTED_TABLE_COLUMNS>;
const EXPECTED_SNAPSHOT_KEYS = ["today:latest", "markets:latest", "news-calendar:latest", "flow:latest", "ownership:latest"];

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
  const { data, error } = await client.from("dashboard_snapshots").select("payload,mode,notices,generated_at,expires_at,metadata").eq("key", key).maybeSingle();
  if (error || !data) return { key, payloadBytes: null, present: false, error: error?.message };
  const now = Date.now();
  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : null;
  return { key, present: true, payloadBytes: Buffer.byteLength(JSON.stringify(data.payload), "utf8"), mode: data.mode, notices: data.notices ?? [], generatedAt: data.generated_at, expiresAt: data.expires_at, fresh: expiresAt == null ? null : expiresAt > now, metadata: data.metadata ?? null, sectionCounts: { darkPool: Array.isArray(data.payload?.darkPool) ? data.payload.darkPool.length : null, whaleFeed: Array.isArray(data.payload?.whaleTrades) ? data.payload.whaleTrades.length : null, insiderTrades: Array.isArray(data.payload?.insiderTrades) ? data.payload.insiderTrades.length : null }, containsSections: { darkPool: Array.isArray(data.payload?.darkPool) && data.payload.darkPool.length > 0, whaleFeed: Array.isArray(data.payload?.whaleTrades) && data.payload.whaleTrades.length > 0, insiderTrades: Array.isArray(data.payload?.insiderTrades) && data.payload.insiderTrades.length > 0 } };
}

function latestMetadataFor(metadata: any[], source: string) {
  return metadata.find((row) => row.source === source) ?? null;
}

function flowDiagnostics(counts: any[], metadata: any[], sizes: any[]) {
  const darkPoolCount = counts.find((row) => row.table === "unusual_whales_dark_pool_flows") ?? null;
  const insiderCount = counts.find((row) => row.table === "unusual_whales_insider_trades") ?? null;
  const whaleFeedCount = counts.find((row) => row.table === "unusual_whales_whale_feed") ?? null;
  const darkPoolMetadata = latestMetadataFor(metadata, "unusual_whales_dark_pool_flows");
  const insiderMetadata = latestMetadataFor(metadata, "unusual_whales_insider_trades");
  const whaleFeedMetadata = latestMetadataFor(metadata, "unusual_whales_whale_feed");
  const flowSnapshotMetadata = latestMetadataFor(metadata, "flow:latest");
  const flowSnapshot = sizes.find((row) => row.key === "flow:latest") ?? null;
  return {
    tableCounts: { darkPool: darkPoolCount, insiderTrades: insiderCount, whaleFeed: whaleFeedCount },
    metadata: { darkPool: darkPoolMetadata, insiderTrades: insiderMetadata, whaleFeed: whaleFeedMetadata, flowLatest: flowSnapshotMetadata },
    latestError: darkPoolMetadata?.error ?? insiderMetadata?.error ?? whaleFeedMetadata?.error ?? flowSnapshotMetadata?.error ?? null,
    darkPoolEmptyReason: darkPoolMetadata?.meta?.emptyReason ?? null,
    darkPoolWindowDays: darkPoolMetadata?.meta?.retentionDays ?? flowSnapshot?.metadata?.darkPoolWindowDays ?? null,
    darkPoolLatestRowCount: darkPoolCount?.count ?? null,
    darkPoolSchemaFields: ["size", "avg30_volume"],
    darkPoolCompleteness: {
      rowsWithSize: darkPoolMetadata?.meta?.rowsWithSize ?? null,
      rowsMissingSize: darkPoolMetadata?.meta?.rowsMissingSize ?? null,
      rowsWithAvg30Volume: darkPoolMetadata?.meta?.rowsWithAvg30Volume ?? null,
      rowsMissingAvg30Volume: darkPoolMetadata?.meta?.rowsMissingAvg30Volume ?? null,
      missingFieldSamples: darkPoolMetadata?.meta?.missingFieldSamples ?? []
    },
    whaleFeedLatestRowCount: whaleFeedCount?.count ?? null,
    whaleFeedLatestMetadata: whaleFeedMetadata ?? null,
    whaleFeedLatestError: whaleFeedMetadata?.error ?? null,
    whaleFeedFetchedCount: whaleFeedMetadata?.meta?.fetched ?? whaleFeedMetadata?.meta?.rawCount ?? null,
    whaleFeedUpsertedCount: whaleFeedMetadata?.meta?.upserted ?? null,
    whaleFeedRowsIncludedInFlowLatest: flowSnapshot?.sectionCounts?.whaleFeed ?? flowSnapshot?.metadata?.whaleFeedRowsUsed ?? null,
    flowLatestIncludesWhaleFeed: (flowSnapshot?.metadata?.whaleFeedRowsUsed ?? 0) > 0 || (flowSnapshot?.sectionCounts?.whaleFeed ?? 0) > 0,
    insiderLookbackMonths: insiderMetadata?.meta?.lookbackMonths ?? null,
    insiderLatestRowCount: insiderCount?.count ?? null,
    insiderLatestMetadata: insiderMetadata ?? null,
    insiderLatestPageCounts: insiderMetadata?.meta?.pageCounts ?? [],
    insiderDuplicatesRemoved: insiderMetadata?.meta?.duplicatesRemoved ?? null,
    insiderDuplicateIdsSample: insiderMetadata?.meta?.duplicateIds ?? [],
    insiderRowsUsedForFlow: flowSnapshot?.metadata?.insiderRowsUsed ?? flowSnapshot?.metadata?.insiderLatestRowCount ?? null,
    insiderAggregateCompanyCount: flowSnapshot?.metadata?.insiderCompaniesAggregated ?? null,
    flowLatestUsesSixMonthInsiderData: flowSnapshot?.metadata?.insiderLookbackMonths === 6 && flowSnapshot?.metadata?.insiderSource === "supabase/source-table",
    flowLatestGeneratedAt: flowSnapshot?.generatedAt ?? null,
    flowLatestExpiresAt: flowSnapshot?.expiresAt ?? null,
    flowLatestContainsSections: flowSnapshot?.containsSections ?? null,
    flowLatestSnapshot: flowSnapshot
  };
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  const statusRows = await getStatusRowsWithDiagnostics();
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
      latestMetadataErrors: [],
      jobs: statusRows.rows.map((row) => ({ group: row.group, job: row.job, functionName: row.functionName, source: row.source, status: row.status, frequency: row.frequency, lastRun: row.lastRun, nextRun: row.nextRun, rowsFetched: row.rowsFetched, rowsInserted: row.rowsInserted, rowsUpdated: row.rowsUpdated, errorMessage: row.errorMessage, warningMessage: row.warningMessage })),
      supabaseReadHealth: statusRows.supabaseReadHealth
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
  const metadataRows = metadataResult.data ?? [];
  const latestMetadataErrors = metadataRows.filter((row: { ok?: boolean; error?: string | null }) => row.ok === false || row.error);
  const flow = flowDiagnostics(counts, metadataRows, sizes);

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
    metadata: metadataResult.error ? [] : metadataRows,
    latestMetadataErrors,
    flow,
    metadataError: metadataResult.error?.message,
    jobs: statusRows.rows.map((row) => ({ group: row.group, job: row.job, functionName: row.functionName, source: row.source, status: row.status, frequency: row.frequency, lastRun: row.lastRun, nextRun: row.nextRun, rowsFetched: row.rowsFetched, rowsInserted: row.rowsInserted, rowsUpdated: row.rowsUpdated, errorMessage: row.errorMessage, warningMessage: row.warningMessage })),
    supabaseReadHealth: statusRows.supabaseReadHealth
  });
}
