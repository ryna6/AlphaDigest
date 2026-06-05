import type { NewsItem } from "../schemas/dashboard";

const UNUSUAL_WHALES_TODAY_URL = "https://unusualwhales.com/news";
const UNUSUAL_WHALES_FEED_URL = "https://unusualwhales.com/news-feed?limit=100&major_only=true";

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

type NewsFetchResult = {
  items: NewsItem[];
  mode: "live" | "unavailable";
  message?: string;
};

type HeadingMatch = {
  headline: string;
  before: string;
  after: string;
};

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => ENTITY_MAP[name.toLowerCase()] ?? entity);
}

function textFromHtml(value: string) {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

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

function timestampFromText(value: string) {
  const text = textFromHtml(value);
  const timestamp = text.match(
    /(?:Today|Yesterday|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)?[\s,]*(?:\d{1,2}:\d{2}\s*(?:AM|PM|ET|EST|EDT)?|\d{1,2}\s*(?:AM|PM)\s*(?:ET|EST|EDT)?)/i
  );
  return timestamp?.[0]?.trim() || "Today";
}

function tickersFromHeadline(headline: string) {
  return Array.from(
    new Set(Array.from(headline.matchAll(/\$([A-Z]{1,6})\b/g), (match) => match[1]))
  ).slice(0, 6);
}

function scrapedHeadingToNews(match: HeadingMatch, timestampPlacement: "after" | "before") {
  const timestamp =
    timestampPlacement === "after"
      ? timestampFromText(match.after)
      : timestampFromText(match.before);

  return {
    headline: match.headline,
    timestamp,
    tickers: tickersFromHeadline(match.headline),
    whyItMatters: "Latest market headline from Unusual Whales.",
    source: "Unusual Whales",
    category: "Market",
    impact: "Medium" as const
  };
}

function headingMatches(html: string, tag: "h3" | "h4") {
  const matches: HeadingMatch[] = [];
  const headingPattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html))) {
    const headline = textFromHtml(match[1]);
    if (!headline) continue;
    matches.push({
      headline,
      before: html.slice(Math.max(0, match.index - 700), match.index),
      after: html.slice(headingPattern.lastIndex, headingPattern.lastIndex + 700)
    });
  }

  return matches;
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; MarketRecapBot/1.0; +https://marketrecap.local)"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) return null;
  return response.text();
}

async function scrapeFeaturedNews(limit: number): Promise<NewsFetchResult> {
  const html = await fetchHtml(UNUSUAL_WHALES_TODAY_URL);
  if (!html)
    return {
      items: [],
      mode: "unavailable",
      message: "Unusual Whales featured page was unavailable."
    };

  const items = uniqueNews(
    headingMatches(html, "h4")
      .map((match) => scrapedHeadingToNews(match, "after"))
      .slice(0, limit)
  );

  return { items, mode: items.length ? "live" : "unavailable" };
}

async function scrapeNewsFeed(limit: number): Promise<NewsFetchResult> {
  const html = await fetchHtml(UNUSUAL_WHALES_FEED_URL);
  if (!html)
    return { items: [], mode: "unavailable", message: "Unusual Whales news feed was unavailable." };

  const items = uniqueNews(
    headingMatches(html, "h3")
      .map((match) => scrapedHeadingToNews(match, "before"))
      .slice(0, limit)
  );

  return { items, mode: items.length ? "live" : "unavailable" };
}

export async function fetchUnusualWhalesFeaturedNews(limit = 5): Promise<NewsFetchResult> {
  return scrapeFeaturedNews(limit);
}

export async function fetchUnusualWhalesNewsFeed(limit = 100): Promise<NewsFetchResult> {
  return scrapeNewsFeed(limit);
}

export const unusualWhalesSources = {
  featured: UNUSUAL_WHALES_TODAY_URL,
  feed: UNUSUAL_WHALES_FEED_URL
};
