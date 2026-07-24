const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const tables = ["market_daily_candles", "sp500_daily_candles"] as const;
type Controls = {
  symbols?: string[];
  table?: (typeof tables)[number];
  from?: string;
  to?: string;
  limitSymbols?: number;
  continue?: boolean;
  resetFailed?: boolean;
  dryRun?: boolean;
  correlationId?: string;
  chainDepth?: number;
};
const date = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) =>
  date.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const authorized = (req: Request) =>
  !!process.env.DAILY_CANDLE_WORKER_TOKEN &&
  req.headers.get("x-alphadigest-worker-token") === process.env.DAILY_CANDLE_WORKER_TOKEN;
export function parseBackfillControls(raw: unknown): Controls {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Body must be an object");
  const body = raw as Record<string, unknown>,
    fail = (m: string): never => {
      throw new Error(m);
    };
  const symbols =
    body.symbols === undefined
      ? undefined
      : !Array.isArray(body.symbols) ||
          body.symbols.some((s) => typeof s !== "string" || !/^[A-Z][A-Z0-9-]*$/.test(s))
        ? fail("symbols must be valid application symbols")
        : [...new Set(body.symbols.map((s) => s.toUpperCase()))];
  const table =
    body.table === undefined
      ? undefined
      : typeof body.table === "string" && (tables as readonly string[]).includes(body.table)
        ? (body.table as Controls["table"])
        : fail("invalid candle table");
  const from =
    body.from === undefined
      ? undefined
      : typeof body.from === "string" && validDate(body.from)
        ? body.from
        : fail("from must be YYYY-MM-DD");
  const to =
    body.to === undefined
      ? undefined
      : typeof body.to === "string" && validDate(body.to)
        ? body.to
        : fail("to must be YYYY-MM-DD");
  if (from && to && from > to) fail("from must not be after to");
  const limitSymbols =
    body.limitSymbols === undefined
      ? undefined
      : Number.isInteger(body.limitSymbols) &&
          (body.limitSymbols as number) >= 1 &&
          (body.limitSymbols as number) <= 5
        ? (body.limitSymbols as number)
        : fail("limitSymbols must be an integer from 1 to 5");
  for (const key of ["continue", "resetFailed", "dryRun"] as const)
    if (body[key] !== undefined && typeof body[key] !== "boolean") fail(`${key} must be boolean`);
  return {
    symbols,
    table,
    from,
    to,
    limitSymbols,
    continue: body.continue === true,
    resetFailed: body.resetFailed === true,
    dryRun: body.dryRun === true
  };
}
export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  if (!authorized(req)) return json({ ok: false, error: "Unauthorized" }, 401);
  try {
    const controls = parseBackfillControls(await req.json());
    const correlationId = crypto.randomUUID(),
      base = process.env.URL || process.env.DEPLOY_URL;
    if (!base) return json({ ok: false, error: "URL or DEPLOY_URL is required" }, 500);
    const workerUrl = new URL(
      "/.netlify/functions/backfill-equity-candles-worker-background",
      base
    ).toString();
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-alphadigest-worker-token": process.env.DAILY_CANDLE_WORKER_TOKEN!
      },
      body: JSON.stringify({ ...controls, correlationId, chainDepth: 0 })
    });
    console.info("backfill_dispatch", {
      correlationId,
      trigger: "manual",
      workerUrl,
      dispatchStatus: res.status,
      selectedFilters: controls
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
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 400);
  }
}
