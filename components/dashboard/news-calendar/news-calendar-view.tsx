"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  EconomicEvent,
  NewsCalendarPayload,
  NewsItem,
  UnusualWhalesEarningsEvent
} from "@/lib/data/schemas/dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { formatEtDateTime, formatEtTime, timestampTitle } from "@/lib/utils/time";
import {
  formatCompactNumber,
  formatCurrency,
  formatDateShort,
  formatMarketCap,
  formatReportTime
} from "@/lib/utils/formatters";

function importanceStars(importance: EconomicEvent["importance"]) {
  const count = { Low: 1, Medium: 2, High: 3 }[importance];
  return "☆".repeat(count);
}

function NewsList({ news }: { news: NewsItem[] }) {
  return (
    <div className="divide-y divide-borderStrong/60">
      {news.map((n, i) => (
        <article key={`${n.headline}-${i}`} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-textPrimary">{n.headline}</p>
              <p className="mt-1 text-xs text-textMuted" title={timestampTitle(n.timestamp)}>
                {formatEtDateTime(n.timestamp)} • {n.publisher ?? n.source ?? "Unusual Whales"}
              </p>
            </div>
            {n.sourceUrl ? (
              <a
                href={n.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 border border-borderStrong px-2 py-1 text-[11px] text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
              >
                Source
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function freshnessLabel(timestamp?: string | null) {
  if (!timestamp) return "Cache pending";
  return `Updated ${formatEtDateTime(timestamp)}`;
}

function dateRangeLabel(events: UnusualWhalesEarningsEvent[]) {
  if (!events.length) return "Rolling window";
  const dates = events.map((event) => event.reportDate).sort();
  return `${formatDateShort(dates[0])} – ${formatDateShort(dates[dates.length - 1])}`;
}

function formatEstimate(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(2);
}

function EarningsTicker({ event }: { event: UnusualWhalesEarningsEvent }) {
  return (
    <div className="flex items-center gap-2">
      {event.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.logo}
          alt=""
          loading="lazy"
          className="h-5 w-5 rounded-full bg-surfaceSubtle object-contain"
        />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surfaceSubtle text-[10px] text-textMuted">
          {event.symbol.slice(0, 1)}
        </span>
      )}
      <span className="font-semibold text-textPrimary">{event.symbol}</span>
    </div>
  );
}

function EarningsTable({
  events,
  compact = false
}: {
  events: UnusualWhalesEarningsEvent[];
  compact?: boolean;
}) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed border-borderStrong p-6 text-center text-sm text-textMuted">
        No cached earnings are available for this range yet. Run the earnings collector to populate
        the cache.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
          <tr className="text-[11px] uppercase tracking-[0.18em] text-textMuted">
            {[
              "Date",
              "Time",
              "Ticker",
              "Company",
              "Sector",
              "Market Cap",
              "Expected Move",
              "OI",
              "Call / Put Vol",
              "EPS Est."
            ].map((header) => (
              <th
                key={header}
                className="border-b border-borderStrong px-3 py-2 font-medium first:pl-0 last:pr-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borderStrong/60">
          {events.map((event) => (
            <tr
              key={event.id}
              className="group transition-colors hover:bg-surfaceSubtle/60 focus-within:bg-surfaceSubtle/60"
            >
              <td className="whitespace-nowrap px-3 py-3 first:pl-0">
                {formatDateShort(event.reportDate)}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-textSecondary">
                {formatReportTime(event.reportTime)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                <EarningsTicker event={event} />
              </td>
              <td className="max-w-[220px] truncate px-3 py-3 text-textPrimary">
                {event.companyName ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-textSecondary">
                {event.sector ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-3">{formatMarketCap(event.marketCap)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-accentBlue">
                {formatCurrency(event.expectedMove)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatCompactNumber(event.openInterest)}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-textSecondary">
                {formatCompactNumber(event.callVolume)} / {formatCompactNumber(event.putVolume)}
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatEstimate(event.epsMeanEstimate ?? event.streetMeanEstimate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact ? null : (
        <p className="mt-3 text-xs text-textMuted">
          Cached rows are loaded from MarketRecap storage, never directly from Unusual Whales in the
          browser.
        </p>
      )}
    </div>
  );
}

function EarningsModule({ data }: { data: NewsCalendarPayload }) {
  const events = useMemo(
    () =>
      [...data.unusualWhalesEarnings]
        .sort((a, b) => (b.openInterest ?? -1) - (a.openInterest ?? -1))
        .slice(0, 10),
    [data.unusualWhalesEarnings]
  );
  return (
    <Panel>
      <SectionHeader
        title="Earnings Calendar"
        subtitle={`${dateRangeLabel(data.unusualWhalesEarnings)} • ${freshnessLabel(data.earningsMetadata?.fetchedAt)}`}
        action={
          <Link
            href="/news-calendar/earnings"
            className="border border-borderStrong px-3 py-1 text-xs text-textSecondary transition-colors hover:border-accentBlue/50 hover:text-textPrimary"
          >
            View All
          </Link>
        }
      />
      {data.earningsMetadata?.ok === false ? (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Earnings cache is stale: {data.earningsMetadata.error ?? "last refresh failed"}
        </div>
      ) : null}
      <EarningsTable events={events} compact />
    </Panel>
  );
}

export function NewsCalendarView({ data }: { data: NewsCalendarPayload }) {
  const latestNews = data.news.slice(0, 8);

  return (
    <>
      <PageTitle
        title="News & Calendar"
        subtitle="What events and headlines are driving markets."
      />
      <Panel>
        <SectionHeader
          title="Latest Market News"
          action={
            <Link
              href="/news-calendar/news"
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            >
              View All
            </Link>
          }
        />
        <NewsList news={latestNews} />
      </Panel>
      <div className="mt-4">
        <EarningsModule data={data} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionHeader title="Economic Calendar" />
          <DataTable
            rows={data.economicCalendar.map((e) => ({
              Time: formatEtTime(e.time),
              Event: e.event,
              Actual: e.actual ?? "—",
              Forecast: e.forecast ?? "—",
              Previous: e.previous ?? "—",
              Importance: importanceStars(e.importance)
            }))}
          />
        </Panel>
        <Panel>
          <SectionHeader title="Legacy Earnings Snapshot" />
          <DataTable
            rows={data.earnings.map((e) => ({
              Ticker: e.ticker,
              Company: e.company,
              Time: e.time,
              "Expected EPS": e.expectedEps,
              "Actual EPS": e.actualEps ?? "—",
              "Expected Rev": e.expectedRevenue ?? "—",
              "Actual Rev": e.actualRevenue ?? "—"
            }))}
          />
        </Panel>
      </div>
    </>
  );
}

export function AllNewsView({ data }: { data: NewsCalendarPayload }) {
  const [visibleCount, setVisibleCount] = useState(Math.min(20, data.news.length, 100));
  const news = data.news.slice(0, visibleCount);
  const canLoadMore = visibleCount < Math.min(data.news.length, 100);

  return (
    <>
      <PageTitle
        title="Latest Market News"
        subtitle="The most recent headline-feed items available to MarketRecap."
      />
      <Panel>
        <SectionHeader
          title={`Most Recent ${news.length} Headlines`}
          action={
            <Link
              href="/news-calendar"
              className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            >
              Back
            </Link>
          }
        />
        <NewsList news={news} />
        <div className="mt-4 flex justify-center border-t border-borderStrong pt-4">
          <button
            type="button"
            disabled={!canLoadMore}
            onClick={() => setVisibleCount((count) => Math.min(count + 20, data.news.length, 100))}
            className="border border-borderStrong px-4 py-2 text-xs font-semibold text-textSecondary disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/50 enabled:hover:text-textPrimary"
          >
            {canLoadMore ? "More" : "No more headlines"}
          </button>
        </div>
      </Panel>
    </>
  );
}

export function AllEarningsView({ data }: { data: NewsCalendarPayload }) {
  const [visibleCount, setVisibleCount] = useState(Math.min(20, data.unusualWhalesEarnings.length));
  const [query, setQuery] = useState("");
  const [sp500Only, setSp500Only] = useState(false);
  const [hasOptionsOnly, setHasOptionsOnly] = useState(false);
  const [sort, setSort] = useState("oi");

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const rows = data.unusualWhalesEarnings.filter((event) => {
      if (sp500Only && !event.isSp500) return false;
      if (hasOptionsOnly && !event.hasOptions) return false;
      if (!q) return true;
      return event.symbol.includes(q) || (event.companyName ?? "").toUpperCase().includes(q);
    });
    const value = (event: UnusualWhalesEarningsEvent) => {
      switch (sort) {
        case "market_cap":
          return event.marketCap ?? -1;
        case "expected_move":
          return event.expectedMove ?? -1;
        case "report_date":
          return new Date(event.reportDate).getTime();
        case "call_volume":
          return event.callVolume ?? -1;
        case "put_volume":
          return event.putVolume ?? -1;
        default:
          return event.openInterest ?? -1;
      }
    };
    return [...rows].sort((a, b) => value(b) - value(a));
  }, [data.unusualWhalesEarnings, hasOptionsOnly, query, sort, sp500Only]);

  const visible = filtered.slice(0, visibleCount);
  const canLoadMore = visibleCount < filtered.length;

  return (
    <>
      <PageTitle
        title="Earnings Calendar"
        subtitle={`${dateRangeLabel(data.unusualWhalesEarnings)} • ${freshnessLabel(data.earningsMetadata?.fetchedAt)}`}
      />
      <Panel>
        <div className="mb-4 flex flex-col gap-3 border-b border-borderStrong pb-4 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/news-calendar"
            className="w-fit border border-borderStrong px-3 py-1.5 text-xs text-textSecondary transition-colors hover:border-accentBlue/50 hover:text-textPrimary"
          >
            ← Back
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(20);
              }}
              placeholder="Search ticker/company"
              className="border border-borderStrong bg-transparent px-3 py-1.5 text-xs text-textPrimary outline-none placeholder:text-textMuted focus:border-accentBlue/60"
            />
            <label className="flex items-center gap-2 border border-borderStrong px-3 py-1.5 text-xs text-textSecondary">
              <input
                type="checkbox"
                checked={sp500Only}
                onChange={(event) => {
                  setSp500Only(event.target.checked);
                  setVisibleCount(20);
                }}
              />{" "}
              S&P 500
            </label>
            <label className="flex items-center gap-2 border border-borderStrong px-3 py-1.5 text-xs text-textSecondary">
              <input
                type="checkbox"
                checked={hasOptionsOnly}
                onChange={(event) => {
                  setHasOptionsOnly(event.target.checked);
                  setVisibleCount(20);
                }}
              />{" "}
              Options
            </label>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setVisibleCount(20);
              }}
              className="border border-borderStrong bg-surface px-3 py-1.5 text-xs text-textPrimary outline-none focus:border-accentBlue/60"
            >
              <option value="oi">Sort: OI</option>
              <option value="market_cap">Sort: Market cap</option>
              <option value="expected_move">Sort: Expected move</option>
              <option value="report_date">Sort: Report date</option>
              <option value="call_volume">Sort: Call volume</option>
              <option value="put_volume">Sort: Put volume</option>
            </select>
          </div>
        </div>
        {data.earningsMetadata?.ok === false ? (
          <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            Earnings cache is stale: {data.earningsMetadata.error ?? "last refresh failed"}
          </div>
        ) : null}
        <EarningsTable events={visible} />
        <div className="mt-5 flex justify-center border-t border-borderStrong pt-4">
          <button
            type="button"
            disabled={!canLoadMore}
            onClick={() => setVisibleCount((count) => Math.min(count + 20, filtered.length))}
            className="rounded-full border border-borderStrong bg-surfaceSubtle px-5 py-2 text-xs font-semibold text-textSecondary shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/60 enabled:hover:text-textPrimary enabled:hover:shadow-accentBlue/10"
          >
            {canLoadMore
              ? `More (${Math.min(visibleCount + 20, filtered.length)} of ${filtered.length})`
              : `Showing all ${filtered.length}`}
          </button>
        </div>
      </Panel>
    </>
  );
}
