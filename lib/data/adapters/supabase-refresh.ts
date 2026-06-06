import type { SupabaseClient } from "@supabase/supabase-js";
import { stableHash } from "./unusual-whales-earnings";

export type RefreshSourceResult = {
  ok: boolean;
  count: number;
  changed: boolean | null;
  error: string | null;
  contentHash: string | null;
  upserted?: number;
  persisted?: boolean;
  meta?: Record<string, unknown> | null;
};

export function payloadContentHash(rows: unknown[]) {
  return stableHash(
    rows.map((row) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        const {
          fetchedAt: _fetchedAt,
          fetched_at: _fetched_at,
          updatedAt: _updatedAt,
          updated_at: _updated_at,
          ...rest
        } = row as Record<string, unknown>;
        return rest;
      }
      return row;
    })
  );
}

export async function updateRefreshMetadata(
  client: SupabaseClient,
  source: string,
  values: {
    ok: boolean;
    changed: boolean | null;
    rowCount: number;
    contentHash?: string | null;
    error?: string | null;
    meta?: Record<string, unknown> | null;
  }
) {
  const { error } = await client.from("data_refresh_metadata").upsert(
    {
      source,
      ok: values.ok,
      fetched_at: new Date().toISOString(),
      changed: values.changed,
      row_count: values.rowCount,
      content_hash: values.contentHash ?? null,
      error: values.error ?? null,
      meta: values.meta ?? null
    },
    { onConflict: "source" }
  );
  if (error) throw new Error(`Supabase metadata upsert failed for ${source}: ${error.message}`);
}

export function sourceResult(
  values: Partial<RefreshSourceResult> & Pick<RefreshSourceResult, "ok" | "count">
): RefreshSourceResult {
  return {
    ok: values.ok,
    count: values.count,
    changed: values.changed ?? null,
    error: values.error ?? null,
    contentHash: values.contentHash ?? null,
    ...(values.upserted !== undefined ? { upserted: values.upserted } : {}),
    ...(values.persisted !== undefined ? { persisted: values.persisted } : {}),
    ...(values.meta !== undefined ? { meta: values.meta } : {})
  };
}
