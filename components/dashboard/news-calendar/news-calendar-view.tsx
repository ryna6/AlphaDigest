"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatEtDateKey, formatEtDateTime, formatEtTime, timestampTitle } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { getMajorEarningsForDate, groupEarningsBySession } from "@/lib/data/earnings-utils";
import { getEconomicActualTone } from "@/lib/data/economic-surprise";

export type WeekOffset = -1 | 0 | 1;
type EarningsGroupKey = "premarket" | "postmarket";

export type DaySelection = {
  weekOffset: WeekOffset;
  selectedDate: string;
  selectedWeekday: number;
  days: Array<{ date: string; label: string; weekday: number }>;
};

function importanceStars(importance: EconomicEvent["importance"], stars?: EconomicEvent["stars"]) {
  const count = stars ?? { Low: 1, Medium: 2, High: 3 }[importance];
  return "★".repeat(count);
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

function isDateKey(value: string | undefined | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayForDateKey(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5 ? weekday : 1;
}

function mondayForDateKey(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysToDateKey(dateKey, -daysFromMonday);
}

function weekdayLabelForDateKey(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function buildWeekDays(weekOffset: WeekOffset, today = new Date()) {
  const todayEtDateKey = formatEtDateKey(today) ?? today.toISOString().slice(0, 10);
  const monday = addDaysToDateKey(mondayForDateKey(todayEtDateKey), weekOffset * 7);
  return Array.from({ length: 5 }, (_, index) => {
    const dayDateKey = addDaysToDateKey(monday, index);
    return {
      date: dayDateKey,
      label: weekdayLabelForDateKey(dayDateKey),
      weekday: index + 1
    };
  });
}

export function initialDaySelection(today = new Date()): DaySelection {
  const todayEtDateKey = formatEtDateKey(today) ?? today.toISOString().slice(0, 10);
  const selectedWeekday = weekdayForDateKey(todayEtDateKey);
  const days = buildWeekDays(0, today);
  return {
    weekOffset: 0,
    selectedWeekday,
    selectedDate: days[selectedWeekday - 1]?.date ?? days[0].date,
    days
  };
}

function debugEconomicCalendarSelection(message: string, details: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("debugEconomicCalendar") !== "1") return;
    console.info(`[economic-calendar] ${message}`, details);
  } catch {
    // localStorage may be unavailable in private browsing or SSR-like environments.
  }
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
    const selectedDay = days[selection.selectedWeekday - 1] ?? days[0];
    const nextSelection = {
      weekOffset: nextOffset,
      selectedWeekday: selectedDay.weekday,
      selectedDate: selectedDay.date,
      days
    };
    debugEconomicCalendarSelection("week-change", nextSelection);
    onChange(nextSelection);
  };

  return (
    <div className="rounded-none border border-borderStrong bg-panel/80 p-1.5 shadow-panel">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-7">
        <button
          type="button"
          disabled={selection.weekOffset === -1}
          onClick={() => moveWeek(-1)}
          className="rounded-none border border-borderStrong bg-surfaceSubtle px-1.5 py-2 text-[10px] font-semibold text-textSecondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentBlue/60 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/60 enabled:hover:text-textPrimary"
        >
          Last Week
        </button>
        {selection.days.map((day) => {
          const active = day.date === selection.selectedDate;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => {
                const nextSelection = {
                  ...selection,
                  selectedDate: day.date,
                  selectedWeekday: day.weekday
                };
                debugEconomicCalendarSelection("day-change", nextSelection);
                onChange(nextSelection);
              }}
              className={cn(
                "rounded-none border px-1.5 py-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentBlue/60",
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
          className="rounded-none border border-borderStrong bg-surfaceSubtle px-1.5 py-2 text-[10px] font-semibold text-textSecondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentBlue/60 disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-accentBlue/60 enabled:hover:text-textPrimary"
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
    const topEarnings = getMajorEarningsForDate(data.unusualWhalesEarnings, selectedDate, 8);
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
      <div className="space-y-5">
        <EarningsGroup title="Before Open" events={grouped.premarket} />
        <EarningsGroup title="After Close" events={grouped.postmarket} />
      </div>
    </Panel>
  );
}

function eventDateKey(event: EconomicEvent) {
  if (isDateKey(event.eventDate)) return event.eventDate;
  const direct = /^\d{4}-\d{2}-\d{2}$/.test(event.time) ? event.time : null;
  return direct ?? formatEtDateKey(event.time);
}

function EconomicCalendar({
  initialEvents,
  selectedDate
}: {
  initialEvents: EconomicEvent[];
  selectedDate: string;
}) {
  const [eventsByDate, setEventsByDate] = useState<Record<string, EconomicEvent[]>>(() => ({
    [selectedDate]: initialEvents.filter((event) => eventDateKey(event) === selectedDate)
  }));
  const [loadingDate, setLoadingDate] = useState<string | null>(null);

  useEffect(() => {
    if (eventsByDate[selectedDate]) return;
    let cancelled = false;
    setLoadingDate(selectedDate);
    fetch(`/api/news-calendar/economic?date=${encodeURIComponent(selectedDate)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const events = Array.isArray(payload?.payload?.events) ? payload.payload.events : [];
        setEventsByDate((current) => ({
          ...current,
          [selectedDate]: events.filter(
            (event: EconomicEvent) => eventDateKey(event) === selectedDate
          )
        }));
      })
      .catch(() => {
        if (!cancelled) setEventsByDate((current) => ({ ...current, [selectedDate]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingDate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [eventsByDate, selectedDate]);

  const selectedEvents = (eventsByDate[selectedDate] ?? []).filter(
    (event) => eventDateKey(event) === selectedDate
  );

  useEffect(() => {
    debugEconomicCalendarSelection("display", {
      selectedDate,
      numberOfEventsDisplayed: selectedEvents.length
    });
  }, [selectedDate, selectedEvents.length]);

  return (
    <Panel>
      <SectionHeader title="Economic Calendar" />
      {loadingDate === selectedDate ? (
        <p className="mb-3 text-xs text-textMuted">Refreshing selected-day events…</p>
      ) : null}
      {selectedEvents.length ? (
        <div className="overflow-hidden rounded-none border border-borderStrong">
          <table className="w-full table-fixed border-collapse text-left text-xs sm:text-[13px]">
            <colgroup>
              <col className="w-[76px] sm:w-[88px]" />
              <col />
              <col className="w-[62px] sm:w-[72px]" />
              <col className="w-[62px] sm:w-[72px]" />
              <col className="w-[62px] sm:w-[72px]" />
            </colgroup>
            <thead className="bg-sidebar text-[10px] uppercase tracking-[0.14em] text-textMuted">
              <tr>
                {(["Time", "Event", "Actual", "Forecast", "Previous"] as const).map((column) => (
                  <th
                    key={column}
                    className="border-b border-borderStrong px-2.5 py-2 font-semibold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedEvents.map((event) => (
                <tr
                  key={event.id ?? `${event.event}-${event.time}`}
                  className={cn(
                    "hover:bg-panelHover/60",
                    event.isHighlighted &&
                      "bg-accentBlue/10 shadow-[inset_3px_0_0_rgba(56,189,248,0.95)] ring-1 ring-inset ring-accentBlue/25"
                  )}
                >
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-2.5 py-3 align-top tabular text-textSecondary last:border-b-0"
                    )}
                  >
                    {formatEtTime(event.timestamp ?? event.time)}
                  </td>
                  <td className="min-w-0 border-b border-borderStrong/50 px-2.5 py-3 align-top last:border-b-0">
                    <p
                      className={cn(
                        "whitespace-normal break-words font-semibold leading-snug text-textPrimary",
                        event.isHighlighted && "font-bold text-white"
                      )}
                    >
                      {event.event}
                    </p>
                    <p
                      className="mt-1 text-[11px] leading-none tracking-[0.16em] text-textSecondary"
                      aria-label={`${event.importance} importance`}
                    >
                      {importanceStars(event.importance, event.stars)}
                    </p>
                  </td>
                  {[event.actual, event.forecast, event.previous].map((value, index) => {
                    const actualTone = index === 0 ? getEconomicActualTone(event) : "neutral";
                    return (
                      <td
                        key={`${event.id ?? event.event}-value-${index}`}
                        className={cn(
                          "border-b border-borderStrong/50 px-2.5 py-3 align-top tabular text-textSecondary last:border-b-0",
                          actualTone === "positive" && "font-semibold text-positive",
                          actualTone === "negative" && "font-semibold text-negative"
                        )}
                      >
                        {value ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
          No economic events are available for the selected day.
        </p>
      )}
    </Panel>
  );
}

export function NewsCalendarView({ data }: { data: NewsCalendarPayload }) {
  const latestNews = data.news.slice(0, 12);
  const [selection, setSelection] = useState<DaySelection>(() => initialDaySelection());

  return (
    <>
      <PageTitle title="News & Calendar" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.6fr)]">
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
        <aside className="min-w-0 space-y-4">
          <WeekdaySelector selection={selection} onChange={setSelection} />
          <EconomicCalendar
            initialEvents={data.economicCalendar}
            selectedDate={selection.selectedDate}
          />
          <EarningsCalendar data={data} selectedDate={selection.selectedDate} />
        </aside>
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
      <PageTitle title="Latest Market News" />
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
      <PageTitle title="Earnings Calendar" />
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
