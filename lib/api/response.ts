import { NextResponse } from "next/server";
import { type ZodTypeAny } from "zod";
import { apiEnvelopeSchema } from "@/lib/data/schemas/common";

export function dashboardJson<T extends ZodTypeAny>({
  schema,
  payload,
  mode = "mock",
  notices = ["Mock data enabled. Add API keys in Netlify to enable live data."]
}: {
  schema: T;
  payload: unknown;
  mode?: "mock" | "live" | "cached" | "unavailable";
  notices?: string[];
}) {
  const envelope = apiEnvelopeSchema(schema).parse({
    generatedAt: new Date().toISOString(),
    timezone: "America/New_York",
    mode,
    notices,
    payload
  });

  return NextResponse.json(envelope, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
    }
  });
}
