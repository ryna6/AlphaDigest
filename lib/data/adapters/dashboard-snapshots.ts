import { createServerSupabaseClient } from "@/lib/db/supabase";
import { stableHash } from "./unusual-whales-earnings";
import { updateRefreshMetadata } from "./supabase-refresh";

export type DashboardSnapshot<T> = {
  key: string;
  payload: T;
  mode: string | null;
  notices: string[];
  generatedAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
};

export type ServingSnapshotMetadata = {
  key: string;
  generatedAt: string;
  expiresAt: string | null;
  ageSeconds: number;
  stale: boolean;
  payloadBytes: number;
};

type SnapshotRow = {
  key: string;
  payload: unknown;
  mode: string | null;
  notices: unknown;
  generated_at: string;
  expires_at: string | null;
  metadata: unknown;
};

function normalize<T>(row: SnapshotRow): DashboardSnapshot<T> {
  return {
    key: row.key,
    payload: row.payload as T,
    mode: row.mode,
    notices: Array.isArray(row.notices)
      ? row.notices.filter((item): item is string => typeof item === "string")
      : [],
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
  };
}

export function isSnapshotFresh(snapshot: Pick<DashboardSnapshot<unknown>, "expiresAt">) {
  return !snapshot.expiresAt || new Date(snapshot.expiresAt).getTime() > Date.now();
}

export function servingSnapshotMetadata<T>(
  snapshot: DashboardSnapshot<T>,
  now = Date.now()
): ServingSnapshotMetadata {
  const generatedMs = Date.parse(snapshot.generatedAt);
  return {
    key: snapshot.key,
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    ageSeconds: Number.isFinite(generatedMs)
      ? Math.max(0, Math.floor((now - generatedMs) / 1000))
      : 0,
    stale: Boolean(snapshot.expiresAt && Date.parse(snapshot.expiresAt) <= now),
    payloadBytes: new TextEncoder().encode(JSON.stringify(snapshot.payload)).byteLength
  };
}

export async function getSnapshotOrNull<T>(key: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { snapshot: null, message: supabase.message };
  const { data, error } = await supabase.client
    .from("dashboard_snapshots")
    .select("key,payload,mode,notices,generated_at,expires_at,metadata")
    .eq("key", key)
    .maybeSingle();
  if (error)
    return {
      snapshot: null,
      message: `Supabase dashboard snapshot read failed for ${key}: ${error.message}`
    };
  return {
    snapshot: data ? normalize<T>(data as SnapshotRow) : null,
    message: data ? undefined : `No dashboard snapshot found for ${key}.`
  };
}

export async function getDashboardSnapshot<T>(key: string) {
  return getSnapshotOrNull<T>(key);
}

/**
 * Read a snapshot for a public rendering path. Unlike the refresh-oriented
 * helper below, expiry is metadata rather than a reason to reject the row.
 * This function intentionally has no builder or write callback.
 */
export async function getDashboardSnapshotForServing<T>(key: string) {
  const result = await getSnapshotOrNull<T>(key);
  if (!result.snapshot) return { ...result, metadata: null };
  const metadata = servingSnapshotMetadata(result.snapshot);
  return { ...result, metadata };
}

export async function getFreshDashboardSnapshot<T>(key: string) {
  const result = await getSnapshotOrNull<T>(key);
  if (!result.snapshot || !isSnapshotFresh(result.snapshot)) return { ...result, snapshot: null };
  return result;
}

export async function upsertDashboardSnapshot(
  key: string,
  payload: unknown,
  options: {
    ttlSeconds?: number;
    mode?: string;
    notices?: string[];
    metadata?: Record<string, unknown>;
  } = {}
) {
  const supabase = createServerSupabaseClient();
  const generatedAt = new Date();
  const expiresAt = options.ttlSeconds
    ? new Date(generatedAt.getTime() + options.ttlSeconds * 1000).toISOString()
    : null;
  const sourceHash = stableHash(payload);
  if (!supabase.ok) return { ok: false, persisted: false, error: supabase.message, sourceHash };
  const { error } = await supabase.client.from("dashboard_snapshots").upsert(
    {
      key,
      payload,
      mode: options.mode ?? null,
      notices: options.notices ?? [],
      generated_at: generatedAt.toISOString(),
      expires_at: expiresAt,
      metadata: options.metadata ?? {}
    },
    { onConflict: "key" }
  );
  if (!error) {
    await updateRefreshMetadata(supabase.client, `dashboard_snapshot:${key}`, {
      ok: true,
      changed: true,
      rowCount: 1,
      contentHash: sourceHash,
      meta: { expiresAt, mode: options.mode ?? null }
    });
  }
  return { ok: !error, persisted: !error, error: error?.message ?? null, sourceHash, expiresAt };
}

export async function listDashboardSnapshotStatus(limit = 25) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok)
    return { ok: false as const, configured: false, message: supabase.message, snapshots: [] };
  const { data, error } = await supabase.client
    .from("dashboard_snapshots")
    .select("key,payload,mode,generated_at,expires_at,metadata")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, configured: true, message: error.message, snapshots: [] };
  return {
    ok: true as const,
    configured: true,
    snapshots: (data ?? []).map((row) => ({
      key: row.key,
      mode: row.mode,
      generated_at: row.generated_at,
      expires_at: row.expires_at,
      metadata: row.metadata,
      ageSeconds: Math.max(0, Math.floor((Date.now() - Date.parse(row.generated_at)) / 1000)),
      payloadBytes: new TextEncoder().encode(JSON.stringify(row.payload)).byteLength,
      fresh: !row.expires_at || new Date(row.expires_at).getTime() > Date.now()
    }))
  };
}
