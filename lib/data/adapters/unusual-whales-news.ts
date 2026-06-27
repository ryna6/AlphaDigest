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

function stripHtmlChrome(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
}

const UNUSUAL_WHALES_PROMO_TEXT_SNIPPETS = [
  "For more market-moving headlines, see other news.",
  "Want more market intelligence? Create your free Unusual Whales account for options flow, market tide, GEX, and the full toolkit.",
  "Do you want to see how to make more plays? Do you want to find gains yourself?",
  "Unusual Whales helps you find market opportunities through our market tide, historical options flow, GEX, and much, much more.",
  "Create a free account here to start conquering the market with Unusual Whales."
] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function promoSnippetRegex(value: string) {
  return new RegExp(
    value
      .trim()
      .split(/\s+/)
      .map(escapeRegex)
      .join(String.raw`(?:\s|&nbsp;|<[^>]+>)+`),
    "gi"
  );
}

const UNUSUAL_WHALES_PROMO_TEXT_REGEXES = UNUSUAL_WHALES_PROMO_TEXT_SNIPPETS.map(promoSnippetRegex);

export function removeUnusualWhalesPromoText(value: string) {
  return UNUSUAL_WHALES_PROMO_TEXT_REGEXES.reduce(
    (cleaned, promoRegex) => cleaned.replace(promoRegex, " "),
    value
  );
}

export function stripUnusualWhalesAdSection(html: string) {
  return removeUnusualWhalesPromoText(html);
}

function textFromHtml(value: string) {
  return decodeEntities(
    stripHtmlChrome(value)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function articleTextFromHtml(value: string) {
  return decodeEntities(
    stripHtmlChrome(removeUnusualWhalesPromoText(value))
      .replace(/<\/(p|div|section|article|h[1-6]|li|blockquote)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
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
      "User-Agent": "Mozilla/5.0 (compatible; AlphaDigestBot/1.0; +https://alphadigest.local)"
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
    ...(rawContent
      ? {
          contentText: articleTextFromHtml(rawContent),
          contentHtml: stripUnusualWhalesAdSection(rawContent)
        }
      : {}),
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
      contentHtml: article.contentHtml ?? existing?.contentHtml,
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
        contentHtml: detail.contentHtml ?? fallback.contentHtml,
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

import { createServerSupabaseClient } from "@/lib/db/supabase";
import { payloadContentHash, sourceResult, updateRefreshMetadata } from "./supabase-refresh";
import { stableHash } from "./unusual-whales-earnings";

const NEWS_METADATA_SOURCE = "unusual_whales_news_feed";
const NEWS_RETENTION_DAYS = 3;
const FEATURED_METADATA_SOURCE = "unusual_whales_featured_articles";

type CachedNewsResult = NewsFetchResult & { metadata?: Record<string, unknown> | null };
type CachedFeaturedResult = FeaturedNewsFetchResult & { metadata?: Record<string, unknown> | null };

function newsContentHash(item: NewsItem) {
  return stableHash({
    headline: item.headline,
    timestamp: item.timestamp,
    sourceUrl: item.sourceUrl,
    publisher: item.publisher,
    sentiment: item.sentiment,
    major: item.major,
    category: item.category,
    impact: item.impact
  });
}

function newsId(item: NewsItem) {
  return `uw-news:${stableHash({ headline: item.headline, timestamp: item.timestamp, sourceUrl: item.sourceUrl }).slice(0, 24)}`;
}

function newsToDbRow(item: NewsItem, fetchedAt: string) {
  const id = newsId(item);
  return {
    id,
    headline: item.headline,
    event_time: item.timestamp,
    source_name: item.source ?? item.publisher ?? "Unusual Whales",
    source_url: item.sourceUrl ?? null,
    publisher: item.publisher ?? item.source ?? "Unusual Whales",
    raw: item,
    content_hash: newsContentHash(item),
    fetched_at: fetchedAt,
    updated_at: new Date().toISOString()
  };
}

function newsFromDbRow(row: UnknownRecord): NewsItem {
  return {
    headline: String(row.headline ?? ""),
    timestamp:
      asString(row.event_time) ??
      asString(row.timestamp) ??
      asString(row.fetched_at) ??
      new Date().toISOString(),
    tickers:
      isRecord(row.raw) && Array.isArray(row.raw.tickers)
        ? row.raw.tickers.filter((ticker): ticker is string => typeof ticker === "string")
        : tickersFromText(String(row.headline ?? "")),
    whyItMatters: "Major market headline from the Unusual Whales news feed.",
    source: asString(row.source_name) ?? asString(row.publisher) ?? "Unusual Whales",
    ...(asString(row.source_url) ? { sourceUrl: asString(row.source_url) } : {}),
    ...(asString(row.publisher) ? { publisher: asString(row.publisher) } : {}),
    ...(isRecord(row.raw) && asString(row.raw.sentiment)
      ? { sentiment: asString(row.raw.sentiment) }
      : {}),
    ...(isRecord(row.raw) && typeof row.raw.major === "boolean" ? { major: row.raw.major } : {}),
    ...(isRecord(row.raw) && asString(row.raw.category)
      ? { category: asString(row.raw.category) }
      : {}),
    ...(isRecord(row.raw) && ["Low", "Medium", "High"].includes(String(row.raw.impact))
      ? { impact: row.raw.impact as "Low" | "Medium" | "High" }
      : {})
  };
}

function articleContentHash(item: FeaturedArticle) {
  return stableHash({
    slug: item.slug,
    title: item.title,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    tags: item.tags,
    imageUrl: item.imageUrl,
    excerpt: item.excerpt,
    contentText: item.contentText,
    contentHtml: item.contentHtml,
    sourceUrl: item.sourceUrl
  });
}

function featuredToDbRow(item: FeaturedArticle, fetchedAt: string) {
  return {
    id: `uw-featured:${item.slug}`,
    slug: item.slug,
    title: item.title,
    published_at: item.publishedAt ?? null,
    created_at_source: item.createdAt ?? null,
    tags: item.tags,
    image_url: item.imageUrl ?? null,
    excerpt: item.excerpt ?? null,
    content_text: item.contentText ?? null,
    content_html: item.contentHtml ?? null,
    source_url: item.sourceUrl ?? originalArticleUrl(item.slug),
    raw: item,
    content_hash: articleContentHash(item),
    fetched_at: fetchedAt,
    updated_at: new Date().toISOString()
  };
}

function featuredFromDbRow(row: UnknownRecord): FeaturedArticle {
  const slug = String(row.slug ?? String(row.id ?? "").replace(/^uw-featured:/, ""));
  return {
    slug,
    title: String(row.title ?? slug),
    ...(asString(row.published_at) ? { publishedAt: asString(row.published_at) } : {}),
    ...(asString(row.created_at_source) ? { createdAt: asString(row.created_at_source) } : {}),
    fetchedAt: asString(row.fetched_at) ?? new Date().toISOString(),
    tags: Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    ...(asString(row.image_url) ? { imageUrl: asString(row.image_url) } : {}),
    ...(asString(row.excerpt) ? { excerpt: asString(row.excerpt) } : {}),
    ...(asString(row.content_text) ? { contentText: asString(row.content_text) } : {}),
    ...(asString(row.content_html) ? { contentHtml: asString(row.content_html) } : {}),
    sourceUrl: asString(row.source_url) ?? originalArticleUrl(slug)
  };
}

export async function refreshUnusualWhalesNewsFeed(limit = 100) {
  console.log("force_refresh_fetch", {
    source: NEWS_METADATA_SOURCE,
    url: UNUSUAL_WHALES_HEADLINES_FEED_URL
  });
  const supabase = createServerSupabaseClient();
  const fetchedAt = new Date().toISOString();
  const result = await fetchUnusualWhalesNewsFeed(limit);
  const rows = result.items.map((item) => newsToDbRow(item, fetchedAt));
  const contentHash = payloadContentHash(
    rows.map(({ fetched_at: _fetchedAt, updated_at: _updatedAt, ...row }) => row)
  );
  console.log("force_refresh_normalized", {
    source: NEWS_METADATA_SOURCE,
    fetched: result.items.length,
    normalized: rows.length
  });

  if (!supabase.ok)
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: true,
      contentHash,
      persisted: false,
      error: supabase.message
    });

  try {
    const { data: metadata } = await supabase.client
      .from("data_refresh_metadata")
      .select("content_hash")
      .eq("source", NEWS_METADATA_SOURCE)
      .maybeSingle();
    const changed = metadata?.content_hash !== contentHash;
    const pruneBefore = new Date(
      Date.now() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { count: prunedCount, error: pruneError } = await supabase.client
      .from("unusual_whales_news_feed")
      .delete({ count: "exact" })
      .lt("event_time", pruneBefore);
    if (pruneError) throw new Error(`Supabase news feed prune failed: ${pruneError.message}`);
    let upserted = 0;
    if (rows.length) {
      const { error } = await supabase.client
        .from("unusual_whales_news_feed")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase news feed upsert failed: ${error.message}`);
      upserted = rows.length;
    }
    await updateRefreshMetadata(supabase.client, NEWS_METADATA_SOURCE, {
      ok: true,
      changed,
      rowCount: rows.length,
      contentHash,
      meta: { limit, source_url: UNUSUAL_WHALES_HEADLINES_FEED_URL }
    });
    console.log("force_refresh_upserted", {
      source: NEWS_METADATA_SOURCE,
      upserted,
      changed,
      prunedOlderThan3Days: prunedCount ?? 0
    });
    return sourceResult({
      ok: true,
      count: rows.length,
      changed,
      contentHash,
      upserted,
      persisted: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown news feed refresh error";
    await updateRefreshMetadata(supabase.client, NEWS_METADATA_SOURCE, {
      ok: false,
      changed: null,
      rowCount: rows.length,
      contentHash,
      error: message,
      meta: { limit, source_url: UNUSUAL_WHALES_HEADLINES_FEED_URL }
    });
    console.error("force_refresh_error", { source: NEWS_METADATA_SOURCE, error: message });
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: null,
      contentHash,
      error: message,
      persisted: false
    });
  }
}

export async function refreshUnusualWhalesFeaturedArticles(limit = 50) {
  console.log("force_refresh_fetch", {
    source: FEATURED_METADATA_SOURCE,
    url: unusualWhalesSources.featured
  });
  const supabase = createServerSupabaseClient();
  const fetchedAt = new Date().toISOString();
  const result = await fetchUnusualWhalesFeaturedNews(limit);
  const rows = result.items.map((item) => featuredToDbRow(item, fetchedAt));
  const contentHash = payloadContentHash(
    rows.map(({ fetched_at: _fetchedAt, updated_at: _updatedAt, ...row }) => row)
  );
  console.log("force_refresh_normalized", {
    source: FEATURED_METADATA_SOURCE,
    fetched: result.items.length,
    normalized: rows.length
  });

  if (!supabase.ok)
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: true,
      contentHash,
      persisted: false,
      error: supabase.message
    });

  try {
    const { data: metadata } = await supabase.client
      .from("data_refresh_metadata")
      .select("content_hash")
      .eq("source", FEATURED_METADATA_SOURCE)
      .maybeSingle();
    const changed = metadata?.content_hash !== contentHash;
    const pruneBefore = new Date(
      Date.now() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { count: prunedCount, error: pruneError } = await supabase.client
      .from("unusual_whales_news_feed")
      .delete({ count: "exact" })
      .lt("event_time", pruneBefore);
    if (pruneError) throw new Error(`Supabase news feed prune failed: ${pruneError.message}`);
    let upserted = 0;
    if (rows.length) {
      const { error } = await supabase.client
        .from("unusual_whales_featured_articles")
        .upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase featured articles upsert failed: ${error.message}`);
      upserted = rows.length;
    }
    await updateRefreshMetadata(supabase.client, FEATURED_METADATA_SOURCE, {
      ok: true,
      changed,
      rowCount: rows.length,
      contentHash,
      meta: { limit, source_url: unusualWhalesSources.featured }
    });
    console.log("force_refresh_upserted", { source: FEATURED_METADATA_SOURCE, upserted, changed });
    return sourceResult({
      ok: true,
      count: rows.length,
      changed,
      contentHash,
      upserted,
      persisted: true
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown featured articles refresh error";
    await updateRefreshMetadata(supabase.client, FEATURED_METADATA_SOURCE, {
      ok: false,
      changed: null,
      rowCount: rows.length,
      contentHash,
      error: message,
      meta: { limit, source_url: unusualWhalesSources.featured }
    });
    console.error("force_refresh_error", { source: FEATURED_METADATA_SOURCE, error: message });
    return sourceResult({
      ok: false,
      count: rows.length,
      changed: null,
      contentHash,
      error: message,
      persisted: false
    });
  }
}

export async function getCachedUnusualWhalesNewsFeed(limit = 100): Promise<CachedNewsResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return fetchUnusualWhalesNewsFeed(limit);
  const { data, error } = await supabase.client
    .from("unusual_whales_news_feed")
    .select(
      "id,headline,event_time,source_name,source_url,publisher,raw,content_hash,fetched_at,updated_at"
    )
    .gte(
      "event_time",
      new Date(Date.now() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    )
    .order("event_time", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data?.length) {
    return {
      items: [],
      mode: "unavailable",
      message: error
        ? `Supabase news feed read failed: ${error.message}`
        : "Supabase news feed cache is empty."
    };
  }
  return { items: data.map((row) => newsFromDbRow(row as UnknownRecord)), mode: "live" };
}

export async function getCachedUnusualWhalesFeaturedArticles(
  limit = 50
): Promise<CachedFeaturedResult> {
  const supabase = createServerSupabaseClient();
  if (!supabase.ok) return fetchUnusualWhalesFeaturedNews(limit);
  const { data, error } = await supabase.client
    .from("unusual_whales_featured_articles")
    .select(
      "id,slug,title,published_at,created_at_source,tags,image_url,excerpt,content_text,content_html,source_url,raw,content_hash,fetched_at,updated_at"
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data?.length) {
    return {
      items: [],
      mode: "unavailable",
      message: error
        ? `Supabase featured articles read failed: ${error.message}`
        : "Supabase featured articles cache is empty."
    };
  }
  return { items: data.map((row) => featuredFromDbRow(row as UnknownRecord)), mode: "live" };
}
