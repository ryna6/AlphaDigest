import type { FeaturedArticle, NewsItem } from "../schemas/dashboard";

const UNUSUAL_WHALES_ORIGIN = "https://unusualwhales.com";
const UNUSUAL_WHALES_TODAY_URL = `${UNUSUAL_WHALES_ORIGIN}/news`;
const UNUSUAL_WHALES_HEADLINES_FEED_URL =
  "https://phx.unusualwhales.com/api/news/headlines-feed?limit=100&major_only=true";

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

type FeaturedNewsFetchResult = {
  items: FeaturedArticle[];
  mode: "live" | "unavailable";
  message?: string;
};

type NewsFetchResult = {
  items: NewsItem[];
  mode: "live" | "unavailable";
  message?: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return undefined;
}

function asStringArray(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (isRecord(item)) return asString(item.name) ?? asString(item.title) ?? asString(item.slug);
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
}

function absoluteUrl(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value, UNUSUAL_WHALES_ORIGIN).toString();
  } catch {
    return undefined;
  }
}

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

function tickersFromText(value: string) {
  return Array.from(new Set(Array.from(value.matchAll(/\$?\b([A-Z]{1,6})\b/g), (m) => m[1])))
    .filter((symbol) => !["THE", "AND", "FOR", "CEO", "CFO", "USA", "SEC", "ETF"].includes(symbol))
    .slice(0, 8);
}

async function fetchText(url: string, accept: string) {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      "User-Agent": "Mozilla/5.0 (compatible; MarketRecapBot/1.0; +https://marketrecap.local)"
    },
    cache: "no-store"
  }).catch(() => null);

  if (!response?.ok) return null;
  return response.text();
}

async function fetchJson(url: string) {
  const text = await fetchText(url, "application/json,text/plain,*/*");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function discoverBuildId() {
  const html = await fetchText(UNUSUAL_WHALES_TODAY_URL, "text/html,application/xhtml+xml");
  if (!html) return null;

  return (
    html.match(/"buildId":"([^"]+)"/)?.[1] ??
    html.match(/\/_next\/data\/([^/]+)\/news\.json/)?.[1] ??
    html.match(/\/_next\/static\/([^/]+)\//)?.[1] ??
    null
  );
}

function walk(value: unknown, visit: (record: UnknownRecord) => void, seen = new Set<unknown>()) {
  if (!value || seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit, seen));
    return;
  }

  if (!isRecord(value)) return;
  visit(value);
  Object.values(value).forEach((item) => walk(item, visit, seen));
}

function articleTimestamp(
  article: Pick<FeaturedArticle, "publishedAt" | "createdAt" | "fetchedAt">
) {
  return article.publishedAt ?? article.createdAt ?? article.fetchedAt;
}

function sortFeaturedArticles(items: FeaturedArticle[]) {
  return [...items].sort(
    (a, b) => new Date(articleTimestamp(b)).getTime() - new Date(articleTimestamp(a)).getTime()
  );
}

function originalArticleUrl(slug: string) {
  return `${UNUSUAL_WHALES_ORIGIN}/news/${encodeURIComponent(slug)}`;
}

function normalizeFeaturedRecord(record: UnknownRecord, fetchedAt: string): FeaturedArticle | null {
  const slug = asString(record.slug) ?? asString(record.articleSlug);
  const title =
    asString(record.title) ??
    asString(record.headline) ??
    asString(record.name) ??
    asString(record.seoTitle);
  if (!slug || !title) return null;

  const publishedAt =
    asString(record.publishedAt) ??
    asString(record.published_at) ??
    asString(record.published) ??
    asString(record.date);
  const createdAt = asString(record.createdAt) ?? asString(record.created_at);
  const image = record.image;
  const imageUrl = absoluteUrl(
    asString(record.imageUrl) ??
      asString(record.image_url) ??
      asString(record.thumbnailUrl) ??
      asString(record.thumbnail_url) ??
      asString(record.coverImage) ??
      (isRecord(image) ? (asString(image.url) ?? asString(image.src)) : asString(image))
  );
  const rawContent =
    asString(record.content) ??
    asString(record.body) ??
    asString(record.html) ??
    asString(record.article) ??
    asString(record.description);
  const excerpt =
    asString(record.excerpt) ??
    asString(record.summary) ??
    asString(record.description) ??
    undefined;

  return {
    slug,
    title: textFromHtml(title),
    ...(publishedAt ? { publishedAt } : {}),
    ...(createdAt ? { createdAt } : {}),
    fetchedAt,
    tags: asStringArray(record.tags ?? record.categories ?? record.tickers),
    ...(imageUrl ? { imageUrl } : {}),
    ...(excerpt ? { excerpt: textFromHtml(excerpt) } : {}),
    ...(rawContent ? { contentText: textFromHtml(rawContent) } : {}),
    sourceUrl: originalArticleUrl(slug)
  };
}

function extractFeaturedArticles(payload: unknown, fetchedAt: string) {
  const bySlug = new Map<string, FeaturedArticle>();
  walk(payload, (record) => {
    const article = normalizeFeaturedRecord(record, fetchedAt);
    if (!article) return;
    const existing = bySlug.get(article.slug);
    bySlug.set(article.slug, {
      ...existing,
      ...article,
      contentText: article.contentText ?? existing?.contentText,
      excerpt: article.excerpt ?? existing?.excerpt,
      tags: article.tags.length ? article.tags : (existing?.tags ?? [])
    });
  });
  return sortFeaturedArticles(Array.from(bySlug.values()));
}

async function fetchFeaturedArticleDetail(
  buildId: string,
  slug: string,
  fallback: FeaturedArticle
) {
  const detailUrl = `${UNUSUAL_WHALES_ORIGIN}/_next/data/${encodeURIComponent(buildId)}/news/${encodeURIComponent(slug)}.json?slug=${encodeURIComponent(slug)}`;
  const payload = await fetchJson(detailUrl);
  if (!payload) return fallback;

  const details = extractFeaturedArticles(payload, fallback.fetchedAt);
  const detail = details.find((item) => item.slug === slug) ?? details[0];
  return detail
    ? {
        ...fallback,
        ...detail,
        slug: fallback.slug,
        title: detail.title || fallback.title,
        sourceUrl: fallback.sourceUrl,
        tags: detail.tags.length ? detail.tags : fallback.tags,
        contentText: detail.contentText ?? fallback.contentText,
        excerpt: detail.excerpt ?? fallback.excerpt
      }
    : fallback;
}

export async function fetchUnusualWhalesFeaturedNews(limit = 50): Promise<FeaturedNewsFetchResult> {
  const buildId = await discoverBuildId();
  if (!buildId) {
    return {
      items: [],
      mode: "unavailable",
      message: "Unusual Whales featured article build metadata was unavailable."
    };
  }

  const fetchedAt = new Date().toISOString();
  const collected = new Map<string, FeaturedArticle>();

  for (let page = 1; collected.size < limit && page <= 5; page += 1) {
    const listUrl = `${UNUSUAL_WHALES_ORIGIN}/_next/data/${encodeURIComponent(buildId)}/news.json?page=${page}`;
    const payload = await fetchJson(listUrl);
    if (!payload) break;
    const pageItems = extractFeaturedArticles(payload, fetchedAt);
    if (!pageItems.length) break;
    pageItems.forEach((item) => collected.set(item.slug, item));
  }

  const listItems = sortFeaturedArticles(Array.from(collected.values())).slice(0, limit);
  if (!listItems.length) {
    return {
      items: [],
      mode: "unavailable",
      message: "Unusual Whales featured article list was unavailable."
    };
  }

  const detailedItems = await Promise.all(
    listItems.map((item) => fetchFeaturedArticleDetail(buildId, item.slug, item))
  );

  return { items: sortFeaturedArticles(detailedItems).slice(0, limit), mode: "live" };
}

function normalizeFeedRecord(record: UnknownRecord): NewsItem | null {
  const headline =
    asString(record.headline) ??
    asString(record.title) ??
    asString(record.message) ??
    asString(record.text);
  if (!headline) return null;

  const timestamp =
    asString(record.timestamp) ??
    asString(record.created_at) ??
    asString(record.createdAt) ??
    asString(record.published_at) ??
    asString(record.publishedAt) ??
    asString(record.datetime) ??
    new Date().toISOString();
  const sourceUrl = absoluteUrl(
    asString(record.url) ??
      asString(record.source_url) ??
      asString(record.sourceUrl) ??
      asString(record.link)
  );
  const publisher =
    asString(record.source) ??
    asString(record.publisher) ??
    asString(record.provider) ??
    "Unusual Whales";
  const tickers = asStringArray(record.tickers ?? record.symbols).length
    ? asStringArray(record.tickers ?? record.symbols)
    : tickersFromText(headline);

  return {
    headline: textFromHtml(headline),
    timestamp,
    tickers,
    whyItMatters: "Major market headline from the Unusual Whales news feed.",
    source: publisher,
    publisher,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(asString(record.sentiment) ? { sentiment: asString(record.sentiment) } : {}),
    ...(asBoolean(record.major ?? record.major_only ?? record.is_major) !== undefined
      ? { major: asBoolean(record.major ?? record.major_only ?? record.is_major) }
      : {}),
    category: asString(record.category) ?? "Market",
    impact: "Medium"
  };
}

function extractFeedRecords(payload: unknown) {
  const root = isRecord(payload)
    ? (payload.data ??
      payload.news ??
      payload.headlines ??
      payload.items ??
      payload.results ??
      payload)
    : payload;
  const candidates = Array.isArray(root) ? root : [];
  return candidates
    .map((item) => (isRecord(item) ? normalizeFeedRecord(item) : null))
    .filter((item): item is NewsItem => Boolean(item))
    .slice(0, 100);
}

export async function fetchUnusualWhalesNewsFeed(limit = 100): Promise<NewsFetchResult> {
  const payload = await fetchJson(UNUSUAL_WHALES_HEADLINES_FEED_URL);
  if (!payload) {
    return {
      items: [],
      mode: "unavailable",
      message: "Unusual Whales headlines feed was unavailable."
    };
  }

  const items = extractFeedRecords(payload)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
  return { items, mode: items.length ? "live" : "unavailable" };
}

export const unusualWhalesSources = {
  featured: `${UNUSUAL_WHALES_ORIGIN}/_next/data/{BUILD_ID}/news.json?page=1`,
  feed: UNUSUAL_WHALES_HEADLINES_FEED_URL
};
