import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import {
  articleTextFromHtml,
  getCachedUnusualWhalesFeaturedArticle,
  stripUnusualWhalesAdSection
} from "@/lib/data/adapters/unusual-whales-news";
import { formatEtDateTime, timestampTitle } from "@/lib/utils/time";

export const revalidate = 300;

type ArticleBlock = { type: "h2" | "p"; text: string };

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => ENTITY_MAP[name.toLowerCase()] ?? entity);
}

function sanitizeInlineText(html: string) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim()
  );
}

function safeArticleBlocks(html: string): ArticleBlock[] {
  const cleaned = stripUnusualWhalesAdSection(html);
  const blocks: ArticleBlock[] = [];
  const blockRegex = /<(p|h2)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cleaned))) {
    const text = sanitizeInlineText(match[2]);
    if (text) blocks.push({ type: match[1].toLowerCase() === "h2" ? "h2" : "p", text });
  }
  return blocks.length
    ? blocks
    : articleTextFromHtml(cleaned)
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((text) => ({ type: "p", text }));
}

export default async function TopNewsArticlePage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: { from?: string; count?: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const { article } = await getCachedUnusualWhalesFeaturedArticle(slug);
  if (!article) notFound();

  const timestamp = article.publishedAt ?? article.createdAt ?? article.fetchedAt;
  const fromTopNews = searchParams?.from === "top-news";
  const count = searchParams?.count
    ? `?count=${encodeURIComponent(searchParams.count)}`
    : "?count=20";
  const backHref = fromTopNews ? `/overview/today/top-news${count}` : "/overview/today";
  const articleBlocks = article.contentHtml ? safeArticleBlocks(article.contentHtml) : [];

  return (
    <>
      <PageTitle title="Featured Article" />
      <Panel>
        <SectionHeader
          title="Top News Detail"
          action={
            <Link
              href={backHref}
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            >
              Back
            </Link>
          }
        />
        <article className="mx-auto max-w-3xl">
          <p
            className="text-xs uppercase tracking-[0.2em] text-textMuted"
            title={timestampTitle(timestamp)}
          >
            {formatEtDateTime(timestamp)}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-textPrimary md:text-4xl">
            {article.title}
          </h1>
          {article.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-borderStrong px-2 py-1 text-[11px] text-textSecondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {article.excerpt ? (
            <p className="mt-5 border-l-2 border-accentBlue/60 pl-4 text-base leading-7 text-textSecondary">
              {article.excerpt}
            </p>
          ) : null}
          {articleBlocks.length ? (
            <div className="mt-6 max-w-[72ch] border-t border-borderStrong pt-6 text-base leading-[1.65] text-textPrimary">
              {articleBlocks.map((block, index) =>
                block.type === "h2" ? (
                  <h2
                    key={`${article.slug}-heading-${index}`}
                    className="mb-3 mt-7 text-lg font-bold leading-snug text-textPrimary first:mt-0"
                  >
                    {block.text}
                  </h2>
                ) : (
                  <p key={`${article.slug}-paragraph-${index}`} className="mb-4 last:mb-0">
                    {block.text}
                  </p>
                )
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-textMuted">
              Full article text was unavailable in the saved article detail data.
            </p>
          )}
          {article.sourceUrl ? (
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex border border-borderStrong px-3 py-2 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            >
              Original source
            </a>
          ) : null}
        </article>
      </Panel>
    </>
  );
}
