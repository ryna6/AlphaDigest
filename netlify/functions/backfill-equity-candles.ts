const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const authorized = (req: Request) =>
  !!process.env.DAILY_CANDLE_WORKER_TOKEN &&
  req.headers.get("x-alphadigest-worker-token") === process.env.DAILY_CANDLE_WORKER_TOKEN;
export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  if (!authorized(req)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const correlationId = String(body.correlationId ?? crypto.randomUUID());
  const base = process.env.URL || process.env.DEPLOY_URL;
  if (!base)
    return json(
      { ok: false, error: "URL or DEPLOY_URL is required to dispatch the background worker" },
      500
    );
  const res = await fetch(new URL("/.netlify/functions/backfill-equity-candles-background", base), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-alphadigest-worker-token": process.env.DAILY_CANDLE_WORKER_TOKEN!
    },
    body: JSON.stringify({ ...body, correlationId })
  });
  return json(
    {
      ok: res.ok,
      status: res.ok ? "dispatched" : "error",
      correlationId,
      workerStatus: res.status
    },
    res.ok ? 202 : 502
  );
}
