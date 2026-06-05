import type { NewsItem } from "../schemas/dashboard";

const UNUSUAL_WHALES_API_URL = "https://api.unusualwhales.com/api/news/headlines";
const UNUSUAL_WHALES_TODAY_URL = "https://unusualwhales.com/news";
const UNUSUAL_WHALES_FEED_URL = "https://unusualwhales.com/news-feed?limit=100&major_only=true";

type UnusualWhalesHeadline = {
  created_at?: string;
  headline?: string;
  is_major?: boolean;
  meta?: Record<string, unknown>;
  sentiment?: string;
  source?: string;
  tags?: string[];
  tickers?: string[];
};

type NewsFetchResult = {
  items: NewsItem[];
  mode: "live" | "unavailable";
  message?: string;
};

function formatTimestamp(value?: string) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short"
  }).format(date);
}

function impactFromHeadline(item: UnusualWhalesHeadline): NewsItem["impact"] {
  if (item.is_major) return "High";
  const sentiment = item.sentiment?.toLowerCase();
  if (sentiment && sentiment !== "neutral") return "Medium";
  return "Low";
}

function itemToNews(item: UnusualWhalesHeadline): NewsItem | null {
  if (!item.headline?.trim()) return null;
  const tags = item.tags?.filter(Boolean) ?? [];
  const source = item.source || "Unusual Whales";

  return {
    headline: item.headline.trim(),
    timestamp: formatTimestamp(item.created_at),
    tickers: item.tickers?.filter(Boolean).slice(0, 6) ?? [],
    whyItMatters: tags.length
      ? `Tagged by Unusual Whales as ${tags.slice(0, 3).join(", ")}.`
      : `Latest market headline from ${source}.`,
    source,
    category: tags[0] ?? "Market",
    impact: impactFromHeadline(item)
  };
}

function normalizePayload(payload: unknown): UnusualWhalesHeadline[] {
  if (Array.isArray(payload)) return payload as UnusualWhalesHeadline[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as UnusualWhalesHeadline[];
  }
  return [];
}

function uniqueNews(items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.headline.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchApiNews(params: URLSearchParams): Promise<NewsFetchResult> {
  const token = process.env.UNUSUAL_WHALES_API_KEY;
  if (!token) {
    return {
      items: [],
      mode: "unavailable",
      message: "UNUSUAL_WHALES_API_KEY is not configured."
    };
  }

  const response = await fetch(`${UNUSUAL_WHALES_API_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      items: [],
      mode: "unavailable",
      message: `Unusual Whales API returned ${response.status}.`
    };
  }

  const payload = await response.json();
  const items = uniqueNews(normalizePayload(payload).map(itemToNews).filter(Boolean) as NewsItem[]);
  return { items, mode: items.length ? "live" : "unavailable" };
}

export async function fetchUnusualWhalesFeaturedNews(limit = 5): Promise<NewsFetchResult> {
  const params = new URLSearchParams({ limit: String(limit), page: "0" });
  return fetchApiNews(params);
}

export async function fetchUnusualWhalesNewsFeed(limit = 100): Promise<NewsFetchResult> {
  const params = new URLSearchParams({ limit: String(limit), page: "0", major_only: "true" });
  return fetchApiNews(params);
}

export const unusualWhalesSources = {
  featured: UNUSUAL_WHALES_TODAY_URL,
  feed: UNUSUAL_WHALES_FEED_URL
};
