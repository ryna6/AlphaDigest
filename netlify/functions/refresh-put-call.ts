import {
  isExpectedCboeFetchWindow,
  refreshCboePutCallRatio
} from "../../lib/data/adapters/cboe-put-call";

export const config = { schedule: "5,35 14-21 * * 1-5" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  if (!force && !isExpectedCboeFetchWindow()) {
    return json({
      ok: true,
      skipped: true,
      reason: "Outside expected Cboe 30-minute source release fetch windows: 9:05 AM through 3:35 PM America/Chicago / 10:05 AM through 4:35 PM ET."
    });
  }
  const result = await refreshCboePutCallRatio();
  return json(result, result.ok ? 200 : 502);
}
