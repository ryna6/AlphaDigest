/** Canonical in-app destination for a persisted featured-news article. */
export function featuredArticleHref(slug: string) {
  return `/overview/today/top-news/${encodeURIComponent(slug)}`;
}
