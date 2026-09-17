"use client";

import { useState } from "react";
import Link from "next/link";
import type { FeaturedArticle } from "@/lib/data/schemas/dashboard";
import { FeaturedArticleList } from "@/components/dashboard/today/today-view";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

export function TopNewsListClient({
  articles,
  initialCount
}: {
  articles: FeaturedArticle[];
  initialCount: number;
}) {
  const [visibleCount, setVisibleCount] = useState(Math.min(initialCount, articles.length, 50));
  const shownArticles = articles.slice(0, visibleCount);
  const canLoadMore = visibleCount < Math.min(articles.length, 50);

  return (
    <>
      <PageTitle title="Top News" />
      <Panel>
        <SectionHeader
          title={`Most Recent ${shownArticles.length} Featured Articles`}
          action={
            <Link
              href="/overview/today"
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            >
              Back
            </Link>
          }
        />
        <FeaturedArticleList articles={shownArticles} />
        <div className="mt-4 flex justify-center border-t border-borderStrong pt-4">
          <button
            type="button"
            disabled={!canLoadMore}
            onClick={() => setVisibleCount((count) => Math.min(count + 10, articles.length, 50))}
            className="border border-borderStrong px-4 py-2 text-xs font-semibold text-textSecondary disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/50 enabled:hover:text-textPrimary"
          >
            {canLoadMore ? "More" : "No more articles"}
          </button>
        </div>
      </Panel>
    </>
  );
}
