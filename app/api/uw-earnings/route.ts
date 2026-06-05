import { dashboardJson } from "@/lib/api/response";
import { getCachedUnusualWhalesEarnings } from "@/lib/data/adapters/unusual-whales-earnings";
import { z } from "zod";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  events: z.array(z.unknown()),
  metadata: z.unknown().nullable(),
  mode: z.string(),
  message: z.string().optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await getCachedUnusualWhalesEarnings({
    minDate: url.searchParams.get("min_date") ?? undefined,
    maxDate: url.searchParams.get("max_date") ?? undefined,
    symbol: url.searchParams.get("symbol") ?? undefined,
    sp500Only: url.searchParams.get("sp500_only") === "true",
    hasOptions: url.searchParams.get("has_options") === "true",
    limit: Number(url.searchParams.get("limit") ?? 250),
    order: url.searchParams.get("order") ?? "oi"
  });
  return dashboardJson({
    schema: payloadSchema,
    payload: result,
    mode: result.mode === "supabase" || result.mode === "live" ? "live" : "mock",
    notices: result.message ? [result.message] : []
  });
}
