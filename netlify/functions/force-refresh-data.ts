import {
  defaultEarningsRange,
  refreshUnusualWhalesEarnings
} from "../../lib/data/adapters/unusual-whales-earnings";
import {
  refreshUnusualWhalesFeaturedArticles,
  refreshUnusualWhalesNewsFeed
} from "../../lib/data/adapters/unusual-whales-news";
import {
  economicRefreshDateKeysFromParams,
  refreshInvestingEconomicEvents
} from "../../lib/data/adapters/investing-economic-calendar";
import { refreshYahooMarketQuotes } from "../../lib/data/adapters/yahoo-finance";

type SourceKey = "earnings" | "news" | "featured" | "economic" | "market";

const VALID_SOURCES = new Set<SourceKey | "all">([
  "earnings",
  "news",
  "featured",
  "economic",
  "market",
  "all"
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

function dateParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function requireAdminToken(request: Request, url: URL) {
  const expected = process.env.ADMIN_SYNC_TOKEN;

  const headerToken = request.headers.get("x-admin-token");
  const queryToken = url.searchParams.get("token");

  const received = headerToken || queryToken;

  return Boolean(expected && received && received === expected);
}

async function refreshOne(source: SourceKey, url: URL) {
  try {
    if (source === "earnings") {
      const defaults = defaultEarningsRange();
      const range = {
        minDate: dateParam(url, "min_date") ?? defaults.minDate,
        maxDate: dateParam(url, "max_date") ?? defaults.maxDate
      };

      console.log("force_refresh_start", { source, range });

      const result = await refreshUnusualWhalesEarnings(range);

      console.log("force_refresh_done", {
        source,
        row_count: result.rowCount,
        changed: result.changed,
        upserted: result.changedRows ?? 0
      });

      return {
        ok: true,
        count: result.rowCount,
        changed: result.changed,
        error: null,
        contentHash: result.contentHash,
        persisted: result.persisted,
        upserted: result.changedRows ?? 0
      };
    }

    if (source === "news") {
      console.log("force_refresh_start", { source });
      return await refreshUnusualWhalesNewsFeed(100);
    }

    if (source === "featured") {
      console.log("force_refresh_start", { source });
      return await refreshUnusualWhalesFeaturedArticles(50);
    }

    if (source === "economic") {
      const dates = economicRefreshDateKeysFromParams(url.searchParams);
      console.log("force_refresh_start", { source, dates });
      return await refreshInvestingEconomicEvents(dates);
    }

    console.log("force_refresh_start", { source, symbols: ["^VIX", "ES=F"] });
    return await refreshYahooMarketQuotes(["^VIX", "ES=F"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unknown ${source} refresh error`;
    console.error("force_refresh_error", { source, error: message });

    return {
      ok: false,
      count: 0,
      changed: null,
      error: message,
      contentHash: null
    };
  }
}

export default async function handler(request: Request) {
  const url = new URL(request.url);

  if (!["GET", "POST"].includes(request.method)) {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!requireAdminToken(request, url)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const requestedSource = url.searchParams.get("source") ?? "all";

  if (!VALID_SOURCES.has(requestedSource as SourceKey | "all")) {
    return json(
      {
        ok: false,
        error: "Invalid source",
        validSources: Array.from(VALID_SOURCES)
      },
      400
    );
  }

  const sources: SourceKey[] =
    requestedSource === "all"
      ? ["earnings", "news", "featured", "economic", "market"]
      : [requestedSource as SourceKey];

  const results: Record<string, Awaited<ReturnType<typeof refreshOne>>> = {};

  for (const source of sources) {
    results[source] = await refreshOne(source, url);
  }

  const ok = Object.values(results).every((result) => result.ok);

  return json(
    {
      ok,
      source: requestedSource,
      results
    },
    ok ? 200 : 207
  );
}
