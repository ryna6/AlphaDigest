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
    notices: Array.isArray(row.notices) ? row.notices.filter((item): item is string => typeof item === "string") : [],
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {}
  };
}

export function isSnapshotFresh(snapshot: Pick<DashboardSnapshot<unknown>, "expiresAt">) {
  return !snapshot.expiresAt || new Date(snapshot.expiresAt).getTime() > Date.now();
}

export async function getSnapshotOrNull<T>(key: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return { snapshot: null, message: supabase.message };
  const { data, error } = await supabase.client
    .from("dashboard_snapshots")
    .select("key,payload,mode,notices,generated_at,expires_at,metadata")
    .eq("key", key)
    .maybeSingle();
  if (error) return { snapshot: null, message: `Supabase dashboard snapshot read failed for ${key}: ${error.message}` };
  return { snapshot: data ? normalize<T>(data as SnapshotRow) : null, message: data ? undefined : `No dashboard snapshot found for ${key}.` };
}

export async function getDashboardSnapshot<T>(key: string) {
  return getSnapshotOrNull<T>(key);
}

export async function getFreshDashboardSnapshot<T>(key: string) {
  const result = await getSnapshotOrNull<T>(key);
  if (!result.snapshot || !isSnapshotFresh(result.snapshot)) return { ...result, snapshot: null };
  return result;
}

export async function upsertDashboardSnapshot(
  key: string,
  payload: unknown,
  options: { ttlSeconds?: number; mode?: string; notices?: string[]; metadata?: Record<string, unknown> } = {}
) {
  const supabase = createServerSupabaseClient();
  const generatedAt = new Date();
  const expiresAt = options.ttlSeconds ? new Date(generatedAt.getTime() + options.ttlSeconds * 1000).toISOString() : null;
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
  if (!supabase.ok) return { ok: false as const, configured: false, message: supabase.message, snapshots: [] };
  const { data, error } = await supabase.client
    .from("dashboard_snapshots")
    .select("key,mode,generated_at,expires_at,metadata")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, configured: true, message: error.message, snapshots: [] };
  return {
    ok: true as const,
    configured: true,
    snapshots: (data ?? []).map((row) => ({
      ...row,
      fresh: !row.expires_at || new Date(row.expires_at).getTime() > Date.now()
    }))
  };
}
