import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTodayPayload } from "@/lib/data/live-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { formatEtTime, timestampTitle } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export default async function TopNewsArticlePage({
  params,
  searchParams
}: {
  params: { slug: string };
  searchParams?: { from?: string; count?: string };
}) {
  const { payload } = await getTodayPayload();
  const slug = decodeURIComponent(params.slug);
  const article = payload.featuredNews.find((item) => item.slug === slug);
  if (!article) notFound();

  const timestamp = article.publishedAt ?? article.createdAt ?? article.fetchedAt;
  const fromTopNews = searchParams?.from === "top-news";
  const count = searchParams?.count
    ? `?count=${encodeURIComponent(searchParams.count)}`
    : "?count=20";
  const backHref = fromTopNews ? `/overview/today/top-news${count}` : "/overview/today";

  return (
    <>
      <PageTitle title="Featured Article" subtitle="Internal MarketRecap article view." />
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
        <article>
          <p
            className="text-xs uppercase tracking-[0.2em] text-textMuted"
            title={timestampTitle(timestamp)}
          >
            {formatEtTime(timestamp)}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-textPrimary">{article.title}</h1>
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
          {article.imageUrl ? (
            <div className="relative mt-5 aspect-video overflow-hidden border border-borderStrong bg-sidebar">
              <Image
                src={article.imageUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 900px, 100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          {article.excerpt ? (
            <p className="mt-5 border-l-2 border-accentBlue/60 pl-4 text-sm text-textSecondary">
              {article.excerpt}
            </p>
          ) : null}
          {article.contentText ? (
            <div className="mt-5 whitespace-pre-line text-sm leading-7 text-textPrimary">
              {article.contentText}
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
