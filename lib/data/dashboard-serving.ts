import type { ZodType } from "zod";
import {
  getDashboardSnapshotForServing,
  type ServingSnapshotMetadata
} from "./adapters/dashboard-snapshots";
import {
  flowPayloadSchema,
  marketsPayloadSchema,
  newsCalendarPayloadSchema,
  ownershipPayloadSchema,
  todayPayloadSchema,
  type FlowPayload,
  type MarketsPayload,
  type NewsCalendarPayload,
  type OwnershipPayload,
  type TodayPayload
} from "./schemas/dashboard";

export type DashboardSnapshotKey =
  "today:latest" | "markets:latest" | "news-calendar:latest" | "flow:latest" | "ownership:latest";

type PayloadByKey = {
  "today:latest": TodayPayload;
  "markets:latest": MarketsPayload;
  "news-calendar:latest": NewsCalendarPayload;
  "flow:latest": FlowPayload;
  "ownership:latest": OwnershipPayload;
};

const schemas: { [K in DashboardSnapshotKey]: ZodType<PayloadByKey[K]> } = {
  "today:latest": todayPayloadSchema,
  "markets:latest": marketsPayloadSchema,
  "news-calendar:latest": newsCalendarPayloadSchema,
  "flow:latest": flowPayloadSchema,
  "ownership:latest": ownershipPayloadSchema
};

export type ServingDashboardResult<T> =
  | { ok: true; payload: T; mode: "cached"; notices: string[]; metadata: ServingSnapshotMetadata }
  | { ok: false; payload: null; mode: "unavailable"; notices: string[]; metadata: null };

/** Snapshot-only dashboard reader used by ISR pages and public dashboard APIs. */
export async function getServingDashboardSnapshot<K extends DashboardSnapshotKey>(
  key: K
): Promise<ServingDashboardResult<PayloadByKey[K]>> {
  const result = await getDashboardSnapshotForServing<unknown>(key);
  if (!result.snapshot || !result.metadata) {
    return {
      ok: false,
      payload: null,
      mode: "unavailable",
      notices: [result.message ?? `No dashboard snapshot found for ${key}.`],
      metadata: null
    };
  }

  const parsed = schemas[key].safeParse(result.snapshot.payload);
  if (!parsed.success) {
    console.error("dashboard_serving_snapshot_invalid", {
      key,
      generatedAt: result.snapshot.generatedAt,
      issues: parsed.error.issues.length
    });
    return {
      ok: false,
      payload: null,
      mode: "unavailable",
      notices: [`The ${key} dashboard snapshot is invalid.`],
      metadata: null
    };
  }

  return {
    ok: true,
    payload: parsed.data,
    mode: "cached",
    notices: result.snapshot.notices,
    metadata: result.metadata
  };
}
