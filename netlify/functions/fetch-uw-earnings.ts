import {
  defaultEarningsRange,
  refreshUnusualWhalesEarnings
} from "../../lib/data/adapters/unusual-whales-earnings";

export const config = { schedule: "* * * * *" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function dateParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function handler(request: Request) {
  const defaults = defaultEarningsRange();
  const url = new URL(request.url);
  const range = {
    minDate: dateParam(url, "min_date") ?? defaults.minDate,
    maxDate: dateParam(url, "max_date") ?? defaults.maxDate
  };
  try {
    const result = await refreshUnusualWhalesEarnings(range);
    console.log("uw_earnings_refresh", {
      source: "unusual_whales_earnings",
      min_date: range.minDate,
      max_date: range.maxDate,
      row_count: result.rowCount,
      changed: result.changed,
      persisted: result.persisted
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown earnings refresh error";
    console.error("uw_earnings_refresh_error", {
      min_date: range.minDate,
      max_date: range.maxDate,
      error: message
    });
    return json({ ok: false, range, error: message }, 500);
  }
}
