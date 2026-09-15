import { NextResponse } from "next/server";
import { type ZodTypeAny } from "zod";
import { apiEnvelopeSchema } from "@/lib/data/schemas/common";
import { appendServerTiming } from "@/lib/observability/performance";
import type { ServingSnapshotMetadata } from "@/lib/data/adapters/dashboard-snapshots";

export function dashboardJson<T extends ZodTypeAny>({
  schema,
  payload,
  mode = "mock",
  notices = ["Mock data enabled. Add API keys in Netlify to enable live data."],
  serverTiming,
  snapshot
}: {
  schema: T;
  payload: unknown;
  mode?: "mock" | "live" | "cached" | "unavailable";
  notices?: string[];
  serverTiming?: string;
  snapshot?: ServingSnapshotMetadata;
}) {
  const envelope = apiEnvelopeSchema(schema).parse({
    generatedAt: new Date().toISOString(),
    timezone: "America/Toronto",
    mode,
    notices,
    snapshot,
    payload
  });

  const response = NextResponse.json(envelope, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      "CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Netlify-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300, durable"
    }
  });
  appendServerTiming(response.headers, serverTiming);
  return response;
}
