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
import { formatEtDateKey, formatEtDateTime, formatEtTime, timestampTitle } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { getMajorEarningsForDate, groupEarningsBySession } from "@/lib/data/earnings-utils";

type WeekOffset = -1 | 0 | 1;
type EarningsGroupKey = "premarket" | "postmarket";

type DaySelection = {
  weekOffset: WeekOffset;
  selectedDate: string;
  selectedWeekday: number;
  days: Array<{ date: string; label: string; weekday: number }>;
};

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

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mondayForWeek(date: Date) {
  const day = date.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return addDays(date, -daysFromMonday);
}

function selectedWeekdayFor(date: Date) {
  const weekday = date.getDay();
  return weekday >= 1 && weekday <= 5 ? weekday : 1;
}

function buildWeekDays(weekOffset: WeekOffset, today = new Date()) {
  const monday = addDays(mondayForWeek(today), weekOffset * 7);
  return Array.from({ length: 5 }, (_, index) => {
    const date = addDays(monday, index);
    return {
      date: dateKey(date),
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      }).format(date),
      weekday: index + 1
    };
  });
}

function initialDaySelection(): DaySelection {
  const today = new Date();
  const selectedWeekday = selectedWeekdayFor(today);
  const days = buildWeekDays(0, today);
  return {
    weekOffset: 0,
    selectedWeekday,
    selectedDate: days[selectedWeekday - 1]?.date ?? days[0].date,
    days
  };
}

function WeekdaySelector({
  selection,
  onChange
}: {
  selection: DaySelection;
  onChange: (next: DaySelection) => void;
}) {
  const moveWeek = (direction: -1 | 1) => {
    const nextOffset = Math.max(-1, Math.min(1, selection.weekOffset + direction)) as WeekOffset;
    const days = buildWeekDays(nextOffset);
    const selectedDay = direction === 1 ? days[0] : days[days.length - 1];
    onChange({
      weekOffset: nextOffset,
      selectedWeekday: selectedDay.weekday,
      selectedDate: selectedDay.date,
      days
    });
  };

  return (
    <div className="mt-4 rounded-none border border-borderStrong bg-panel/80 p-2 shadow-panel">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
        <button
          type="button"
          disabled={selection.weekOffset === -1}
          onClick={() => moveWeek(-1)}
          className="rounded-none border border-borderStrong bg-surfaceSubtle px-3 py-2 text-xs font-semibold text-textSecondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentBlue/60 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/60 enabled:hover:text-textPrimary"
        >
          Last Week
        </button>
        {selection.days.map((day) => {
          const active = day.date === selection.selectedDate;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() =>
                onChange({
                  ...selection,
                  selectedDate: day.date,
                  selectedWeekday: day.weekday
                })
              }
              className={cn(
                "rounded-none border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentBlue/60",
                active
                  ? "border-accentBlue/70 bg-accentBlue/15 text-textPrimary shadow-sm shadow-accentBlue/10"
                  : "border-borderStrong bg-surfaceSubtle text-textSecondary hover:border-accentBlue/60 hover:text-textPrimary"
              )}
            >
              {day.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={selection.weekOffset === 1}
          onClick={() => moveWeek(1)}
          className="rounded-none border border-borderStrong bg-surfaceSubtle px-3 py-2 text-xs font-semibold text-textSecondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentBlue/60 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/60 enabled:hover:text-textPrimary"
        >
          Next Week
        </button>
      </div>
    </div>
  );
}

function formatMovePct(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(1)}%`;
}

function selectedDayTitle(selectedDate: string) {
  const date = parseDateKey(selectedDate);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(date);
}

function companyInitials(symbol: string) {
  return symbol.slice(0, 2).toUpperCase();
}

function isUnusualWhalesPlaceholderLogo(logo: string | null | undefined) {
  if (!logo) return false;
  const value = logo.toLowerCase();
  return (
    value.includes("placeholder") ||
    value.includes("default") ||
    value.includes("missing") ||
    value.includes("unknown")
  );
}

function EarningsRow({ event }: { event: UnusualWhalesEarningsEvent }) {
  const logoSrc = event.logo && !isUnusualWhalesPlaceholderLogo(event.logo) ? event.logo : null;
  const showInitials = !event.logo;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-borderStrong/70 bg-surfaceSubtle/60 px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-borderStrong bg-panel text-[11px] font-bold text-textSecondary">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" className="h-full w-full object-cover" />
        ) : showInitials ? (
          companyInitials(event.symbol)
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold tracking-wide text-textPrimary">{event.symbol}</div>
        {event.companyName ? (
          <div className="truncate text-xs text-textMuted">{event.companyName}</div>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] uppercase tracking-[0.18em] text-textMuted">Implied Move</div>
        <div className="tabular text-sm font-semibold text-textPrimary">
          {formatMovePct(event.impliedMovePct)}
        </div>
      </div>
    </div>
  );
}

function EarningsGroup({ title, events }: { title: string; events: UnusualWhalesEarningsEvent[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-textMuted">
        <span>{title}</span>
        <span className="tabular text-textSecondary">{events.length}</span>
      </div>
      {events.length ? (
        <div className="space-y-2">
          {events.map((event) => (
            <EarningsRow key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-borderStrong px-3 py-4 text-center text-xs text-textMuted">
          No qualifying earnings.
        </div>
      )}
    </div>
  );
}

function EarningsCalendar({
  data,
  selectedDate
}: {
  data: NewsCalendarPayload;
  selectedDate: string;
}) {
  const grouped = useMemo(() => {
    const topEarnings = getMajorEarningsForDate(data.unusualWhalesEarnings, selectedDate, 10);
    const groupsBySession = groupEarningsBySession(topEarnings);
    return {
      premarket: groupsBySession.premarket,
      postmarket: [
        ...groupsBySession.postmarket,
        ...groupsBySession.regular,
        ...groupsBySession.unknown
      ]
    } satisfies Record<EarningsGroupKey, UnusualWhalesEarningsEvent[]>;
  }, [data.unusualWhalesEarnings, selectedDate]);

  return (
    <Panel>
      <SectionHeader title="Earnings Calendar" />
      {data.earningsMetadata?.ok === false ? (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Earnings data is stale: {data.earningsMetadata.error ?? "last refresh failed"}
        </div>
      ) : null}
      <div className="mb-4 rounded-xl border border-borderStrong bg-surfaceSubtle/50 px-3 py-2">
        <h3 className="text-lg font-semibold text-textPrimary">{selectedDayTitle(selectedDate)}</h3>
      </div>
      <div className="space-y-5">
        <EarningsGroup title="Before Open" events={grouped.premarket} />
        <EarningsGroup title="After Close" events={grouped.postmarket} />
      </div>
    </Panel>
  );
}

function eventDateKey(event: EconomicEvent) {
  const direct = /^\d{4}-\d{2}-\d{2}$/.test(event.time) ? event.time : null;
  return direct ?? formatEtDateKey(event.time);
}

function EconomicCalendar({
  events,
  selectedDate
}: {
  events: EconomicEvent[];
  selectedDate: string;
}) {
  const selectedEvents = useMemo(() => {
    const todayKey = dateKey(new Date());
    return events.filter((event) => {
      const key = eventDateKey(event);
      if (key) return key === selectedDate;
      return selectedDate === todayKey;
    });
  }, [events, selectedDate]);

  return (
    <Panel>
      <SectionHeader title="Economic Calendar" />
      <DataTable
        rows={selectedEvents.map((e) => ({
          Time: formatEtTime(e.time),
          Event: e.event,
          Actual: e.actual ?? "—",
          Forecast: e.forecast ?? "—",
          Previous: e.previous ?? "—",
          Importance: importanceStars(e.importance)
        }))}
        empty="No economic events are available for the selected day."
      />
    </Panel>
  );
}

export function NewsCalendarView({ data }: { data: NewsCalendarPayload }) {
  const latestNews = data.news.slice(0, 8);
  const [selection, setSelection] = useState<DaySelection>(() => initialDaySelection());

  return (
    <>
      <PageTitle
        title="News & Calendar"
        subtitle="What events and headlines are driving markets."
      />
      <WeekdaySelector selection={selection} onChange={setSelection} />
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <EarningsCalendar data={data} selectedDate={selection.selectedDate} />
        <EconomicCalendar events={data.economicCalendar} selectedDate={selection.selectedDate} />
      </div>
      <Panel className="mt-4">
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
  const [selection, setSelection] = useState<DaySelection>(() => initialDaySelection());

  return (
    <>
      <PageTitle
        title="Earnings Calendar"
        subtitle="Large-cap earnings grouped by report window."
      />
      <div className="mb-4">
        <Link
          href="/news-calendar"
          className="inline-flex border border-borderStrong px-3 py-1.5 text-xs text-textSecondary transition-colors hover:border-accentBlue/50 hover:text-textPrimary"
        >
          ← Back
        </Link>
      </div>
      <WeekdaySelector selection={selection} onChange={setSelection} />
      <div className="mt-4">
        <EarningsCalendar data={data} selectedDate={selection.selectedDate} />
      </div>
    </>
  );
}
