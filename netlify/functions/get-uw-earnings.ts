import { getCachedUnusualWhalesEarnings } from "../../lib/data/adapters/unusual-whales-earnings";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function boolParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  return value === "true" || value === "1";
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 250), 1), 500);
  const result = await getCachedUnusualWhalesEarnings({
    minDate: url.searchParams.get("min_date") ?? undefined,
    maxDate: url.searchParams.get("max_date") ?? undefined,
    symbol: url.searchParams.get("symbol") ?? undefined,
    sp500Only: boolParam(url, "sp500_only"),
    order: url.searchParams.get("order") ?? "oi",
    limit
  });
  return json({ ok: true, ...result, count: result.events.length });
}
