import React from "react";
import path from "node:path";
import Module from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  NewsCalendarPayload,
  TodayPayload,
  UnusualWhalesEarningsEvent
} from "../lib/data/schemas/dashboard";

type ResolveFilename = (
  this: unknown,
  request: string,
  parent?: NodeModule,
  isMain?: boolean,
  options?: unknown
) => string;

const moduleWithResolver = Module as unknown as { _resolveFilename: ResolveFilename };
const originalResolveFilename = moduleWithResolver._resolveFilename;
moduleWithResolver._resolveFilename = function (
  this: unknown,
  request: string,
  parent?: NodeModule,
  isMain?: boolean,
  options?: unknown
) {
  if (typeof request === "string" && request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(process.cwd(), request.slice(2)),
      parent,
      isMain,
      options
    );
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { NewsCalendarView, buildWeekDays, initialDaySelection } =
  require("../components/dashboard/news-calendar/news-calendar-view") as typeof import("../components/dashboard/news-calendar/news-calendar-view");
const { TodayView } =
  require("../components/dashboard/today/today-view") as typeof import("../components/dashboard/today/today-view");
const { normalizeUnusualWhalesEarningsRow } =
  require("../lib/data/adapters/unusual-whales-earnings") as typeof import("../lib/data/adapters/unusual-whales-earnings");
const { IMPORTANT_ECONOMIC_EVENTS, getImportantEconomicEventKey, shouldIncludeEconomicEvent } =
  require("../lib/data/config/included-economic-events") as typeof import("../lib/data/config/included-economic-events");
const {
  buildInvestingEconomicCalendarCacheKey,
  buildInvestingEconomicCalendarUrl,
  normalizeInvestingEconomicCalendarPayload
} =
  require("../lib/data/adapters/investing-economic-calendar") as typeof import("../lib/data/adapters/investing-economic-calendar");
const { ECONOMIC_SURPRISE_RULES, getEconomicActualTone, parseEconomicNumericValue } =
  require("../lib/data/economic-surprise") as typeof import("../lib/data/economic-surprise");
const { todayMock } =
  require("../lib/data/fixtures/mock-dashboard") as typeof import("../lib/data/fixtures/mock-dashboard");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function earningsEvent(
  overrides: Partial<UnusualWhalesEarningsEvent> &
    Pick<
      UnusualWhalesEarningsEvent,
      "id" | "symbol" | "reportDate" | "reportTime" | "marketCap" | "impliedMovePct"
    >
): UnusualWhalesEarningsEvent {
  return {
    source: "unusual_whales_earnings",
    companyName: `${overrides.symbol} Corporation`,
    logo: null,
    marketTime: null,
    sector: null,
    countryCode: null,
    countryName: null,
    isSp500: false,
    hasOptions: true,
    marketCapSize: null,
    currentPrice: 100,
    previousPrice: 98,
    openInterest: 1000,
    callVolume: 500,
    putVolume: 250,
    stockVolume: null,
    expectedMove: null,
    impliedMove: null,
    streetMeanEstimate: null,
    epsMeanEstimate: null,
    lastEarningsDate: null,
    priceLastEarnings: null,
    lastOneDayReactions: [],
    raw: {},
    contentHash: overrides.id,
    fetchedAt: "2026-06-05T12:00:00Z",
    ...overrides
  };
}

const payload: NewsCalendarPayload = {
  news: Array.from({ length: 13 }, (_, index) => ({
    headline:
      index === 0
        ? "PUTIN: DRONES HIT A HAVEN IN ST PETERSBURG, THEY REACHED SOME GOALS"
        : `Market headline ${index + 1}`,
    timestamp: `2026-06-05T${String(16 - Math.floor(index / 2)).padStart(2, "0")}:49:00Z`,
    tickers: ["PUTIN", "DRONES", "HAVEN"],
    whyItMatters: "Fixture news item.",
    source: "Tradex",
    publisher: "Tradex",
    sentiment: "neutral",
    major: true
  })),
  economicCalendar: [
    {
      eventDate: "2026-06-05",
      time: "2026-06-05T13:30:00Z",
      event: "Payrolls",
      actual: "TBD",
      forecast: "185K",
      previous: "175K",
      importance: "High"
    },
    {
      source: "investing_com",
      id: "62:2026-06-05T12:30:00Z",
      eventId: 62,
      eventKey: "corePpi",
      eventDate: "2026-06-05",
      time: "2026-06-05T12:30:00Z",
      timestamp: "2026-06-05T12:30:00Z",
      event: "Core PPI",
      actual: "0.2%",
      forecast: "0.2%",
      previous: "0.1%",
      importance: "High",
      stars: 3,
      isHighlighted: true,
      highlightReason: "Core PPI"
    },
    {
      source: "investing_com",
      id: "733:2026-06-05T13:30:00Z",
      eventId: 733,
      eventKey: "cpi",
      eventDate: "2026-06-05",
      time: "2026-06-05T13:30:00Z",
      timestamp: "2026-06-05T13:30:00Z",
      event: "CPI",
      actual: "3.4%",
      forecast: "3.2%",
      previous: "3.1%",
      importance: "High",
      stars: 3,
      isHighlighted: true,
      highlightReason: "CPI"
    },
    {
      eventDate: "2026-06-04",
      time: "2026-06-04T14:00:00Z",
      event: "Factory Orders",
      forecast: "0.1%",
      previous: "-0.4%",
      importance: "Medium"
    }
  ],
  earnings: [],
  unusualWhalesEarnings: [
    ...Array.from({ length: 11 }, (_, index) => {
      const marketCap = (30 - index) * 1_000_000_000;
      const symbol = `CAP${30 - index}`;
      return earningsEvent({
        id: `uw-earnings:${symbol}:2026-06-05:${index % 2 ? "postmarket" : "premarket"}`,
        symbol,
        companyName: `${symbol} Large Cap Inc`,
        reportDate: "2026-06-05",
        reportTime: index % 2 ? "postmarket" : "premarket",
        marketCap,
        impliedMovePct: 1 + index
      });
    }),
    earningsEvent({
      id: "uw-earnings:BIG:2026-06-05:premarket",
      symbol: "BIG",
      companyName: "Big Cap Inc",
      reportDate: "2026-06-05",
      reportTime: "premarket",
      marketCap: 10_000_000_000,
      impliedMovePct: 9.1
    }),
    earningsEvent({
      id: "uw-earnings:MEGA:2026-06-05:postmarket",
      symbol: "MEGA",
      companyName: "Mega Cap Inc",
      reportDate: "2026-06-05",
      reportTime: "postmarket",
      marketCap: 20_000_000_000,
      impliedMovePct: 4.2
    }),
    earningsEvent({
      id: "uw-earnings:NULLTIME:2026-06-05:unknown",
      symbol: "NULLTIME",
      companyName: "No Time Large Cap Inc",
      reportDate: "2026-06-05",
      reportTime: null,
      marketCap: 12_000_000_000,
      impliedMovePct: 5.5
    }),
    earningsEvent({
      id: "uw-earnings:PHL:2026-06-05:postmarket",
      symbol: "PHL",
      companyName: "Placeholder Logo Inc",
      logo: "https://cdn.unusualwhales.com/images/placeholder-logo.svg",
      reportDate: "2026-06-05",
      reportTime: "postmarket",
      marketCap: 18_000_000_000,
      impliedMovePct: 2.1
    }),
    earningsEvent({
      id: "uw-earnings:SMOL:2026-06-05:premarket",
      symbol: "SMOL",
      companyName: "Small Cap Inc",
      reportDate: "2026-06-05",
      reportTime: "premarket",
      marketCap: 5_000_000_000,
      impliedMovePct: 12.3
    }),
    earningsEvent({
      id: "uw-earnings:OLD:2026-06-04:premarket",
      symbol: "OLD",
      companyName: "Old Day Inc",
      reportDate: "2026-06-04",
      reportTime: "premarket",
      marketCap: 15_000_000_000,
      impliedMovePct: 3.3
    })
  ],
  earningsMetadata: {
    source: "fixture",
    ok: true,
    fetchedAt: "2026-06-05T12:00:00Z",
    changed: null,
    rowCount: 4,
    contentHash: "fixture",
    error: null,
    meta: null
  },
  sourceMeta: []
};

const normalized = normalizeUnusualWhalesEarningsRow({
  symbol: "CALC",
  report_date: "2026-06-05",
  report_time: "premarket",
  marketcap: "6000000000",
  implied_move: "4.55",
  curr: "50"
});
assert(normalized?.impliedMovePct === 9.1, "implied move percentage calculation failed");

assert(IMPORTANT_ECONOMIC_EVENTS.corePpi.eventIds.includes(62), "Core PPI should use event ID 62");
assert(IMPORTANT_ECONOMIC_EVENTS.ppi.eventIds.includes(238), "PPI should use event ID 238");
assert(
  !IMPORTANT_ECONOMIC_EVENTS.coreCpi.eventIds.includes(922),
  "Core CPI should not include event ID 922"
);
for (const extraId of [11852, 28682, 31473]) {
  assert(
    !IMPORTANT_ECONOMIC_EVENTS.nonfarmPayrolls.eventIds.includes(extraId),
    `Nonfarm Payrolls should not include event ID ${extraId}`
  );
}
assert(
  getImportantEconomicEventKey(62, "Unexpected name") === "corePpi",
  "highlight matching by event ID failed"
);
assert(
  getImportantEconomicEventKey(null, "Core CPI m/m") === "coreCpi",
  "highlight fallback matching by event name failed"
);
assert(
  shouldIncludeEconomicEvent("ISM Services PMI"),
  "medium/high events should be included by default"
);
assert(!shouldIncludeEconomicEvent("Fed Chair Powell Speaks"), "Fed speaks should be excluded");
assert(
  !shouldIncludeEconomicEvent("Crude Oil Inventories"),
  "crude oil inventory events should be excluded"
);
assert(ECONOMIC_SURPRISE_RULES.cpi === "lower_is_good", "CPI should use lower_is_good");
assert(ECONOMIC_SURPRISE_RULES.coreCpi === "lower_is_good", "Core CPI should use lower_is_good");
assert(ECONOMIC_SURPRISE_RULES.ppi === "lower_is_good", "PPI should use lower_is_good");
assert(ECONOMIC_SURPRISE_RULES.corePpi === "lower_is_good", "Core PPI should use lower_is_good");
assert(
  ECONOMIC_SURPRISE_RULES.unemploymentRate === "lower_is_good",
  "Unemployment Rate should use lower_is_good"
);
assert(ECONOMIC_SURPRISE_RULES.gdp === "higher_is_good", "GDP should use higher_is_good");
assert(
  ECONOMIC_SURPRISE_RULES.interestRateDecision === "neutral",
  "Interest Rate Decision should stay neutral"
);
assert(parseEconomicNumericValue("172K") === 172000, "economic parser should handle K suffix");
assert(parseEconomicNumericValue("1.2M") === 1200000, "economic parser should handle M suffix");
assert(parseEconomicNumericValue("2.8%") === 2.8, "economic parser should handle percentages");
assert(
  getEconomicActualTone({ event: "CPI", eventKey: "cpi", actual: "3.4%", forecast: "3.2%" }) ===
    "negative",
  "CPI above forecast should be negative"
);
assert(
  getEconomicActualTone({
    event: "Core CPI",
    eventKey: "coreCpi",
    actual: "3.1%",
    forecast: "3.3%"
  }) === "positive",
  "Core CPI below forecast should be positive"
);
assert(
  getEconomicActualTone({
    event: "Unemployment Rate",
    eventKey: "unemploymentRate",
    actual: "4.2%",
    forecast: "4.0%"
  }) === "negative",
  "Unemployment Rate above forecast should be negative"
);
assert(
  getEconomicActualTone({ event: "GDP", eventKey: "gdp", actual: "2.8%", forecast: "2.1%" }) ===
    "positive",
  "GDP above forecast should be positive"
);
assert(
  getEconomicActualTone({
    event: "Interest Rate Decision",
    eventKey: "interestRateDecision",
    actual: "5.50%",
    forecast: "5.25%"
  }) === "neutral",
  "Interest Rate Decision should not get misleading red/green"
);
function assertWeeklyInvestingUrl(dateKey: string) {
  const investingUrl = buildInvestingEconomicCalendarUrl(dateKey);
  const parsed = new URL(investingUrl);
  const start = parsed.searchParams.get("start_date");
  const end = parsed.searchParams.get("end_date");
  if (!start) throw new Error(`${dateKey} start_date should be present`);
  if (!end) throw new Error(`${dateKey} end_date should be present`);
  assert(
    start === `2026-06-01T00:00:00.000-04:00`,
    `${dateKey} start_date should be the Monday week start in ET`
  );
  assert(
    end === `2026-06-07T23:59:59.999-04:00`,
    `${dateKey} end_date should be the Sunday week end in ET`
  );
  assert(start.slice(0, 10) !== end.slice(0, 10), `${dateKey} start/end dates should span a week`);
  assert(
    investingUrl.includes(encodeURIComponent(`2026-06-01T00:00:00.000-04:00`)),
    "start_date should be URL-encoded"
  );
}

for (const dateKey of ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"]) {
  assertWeeklyInvestingUrl(dateKey);
  assert(
    buildInvestingEconomicCalendarCacheKey(dateKey) ===
      `investing-economic:US:medium-high:2026-06-01:2026-06-07`,
    "Investing.com cache key should include selected week range"
  );
}

const currentWeekDays = buildWeekDays(0, new Date("2026-06-05T16:00:00Z"));
const previousWeekDays = buildWeekDays(-1, new Date("2026-06-05T16:00:00Z"));
const nextWeekDays = buildWeekDays(1, new Date("2026-06-05T16:00:00Z"));
assert(
  currentWeekDays.map((day) => day.date).join(",") ===
    "2026-06-01,2026-06-02,2026-06-03,2026-06-04,2026-06-05",
  "current-week selector dates should map Monday through Friday"
);
assert(
  previousWeekDays.map((day) => day.date).join(",") ===
    "2026-05-25,2026-05-26,2026-05-27,2026-05-28,2026-05-29",
  "Last Week should generate previous weekday dates"
);
assert(
  nextWeekDays.map((day) => day.date).join(",") ===
    "2026-06-08,2026-06-09,2026-06-10,2026-06-11,2026-06-12",
  "Next Week should generate next weekday dates"
);
const initialSelection = initialDaySelection(new Date("2026-06-05T16:00:00Z"));
assert(
  initialSelection.weekOffset === 0 &&
    initialSelection.selectedWeekday === 5 &&
    initialSelection.selectedDate === "2026-06-05",
  "initial selector state should select the current ET weekday"
);
assert(
  previousWeekDays[initialSelection.selectedWeekday - 1]?.date === "2026-05-29" &&
    nextWeekDays[initialSelection.selectedWeekday - 1]?.date === "2026-06-12",
  "Last Week and Next Week should preserve the selected weekday when regenerating dates"
);

const investingEvents = normalizeInvestingEconomicCalendarPayload(
  {
    events: [
      {
        event_id: 227,
        event_translated: "Nonfarm Payrolls",
        importance: "high",
        country_id: 5,
        currency: "USD"
      },
      {
        event_id: 52,
        event_translated: "Consumer Credit",
        importance: "medium",
        country_id: 5,
        currency: "USD"
      },
      {
        event_id: 1810,
        event_translated: "U.S. Baker Hughes Total Rig Count",
        importance: "medium",
        country_id: 5,
        currency: "USD"
      }
    ],
    occurrences: [
      {
        event_id: 227,
        occurrence_time: "2026-06-05T12:30:00Z",
        actual: 172,
        forecast: 85,
        previous: 179,
        unit: "K"
      },
      {
        event_id: 52,
        occurrence_time: "2026-06-05T19:00:00Z",
        actual: 20.73,
        forecast: 17.8,
        previous: 22.23,
        unit: "B"
      },
      {
        event_id: 1810,
        occurrence_time: "2026-06-05T17:00:00Z",
        actual: 563,
        previous: 562
      }
    ]
  },
  "2026-06-05",
  "2026-06-05T00:00:00Z"
);
assert(
  investingEvents.some((event) => event.eventName === "Consumer Credit"),
  "Investing.com metadata/occurrence merge should include non-highlight medium events"
);
assert(
  investingEvents.some(
    (event) =>
      event.eventName === "Nonfarm Payrolls" &&
      event.timestamp?.startsWith("2026-06-05T12:30:00") &&
      event.eventDate === "2026-06-05" &&
      event.id.startsWith("investing-economic:2026-06-05:227:") &&
      event.actual === "172K" &&
      event.isHighlighted
  ),
  "Investing.com occurrences should merge event names, timestamps, values, and highlight status"
);
assert(
  !investingEvents.some((event) => /Rig Count/.test(event.eventName)),
  "Investing.com normalization should apply excluded event patterns"
);

const RealDate = Date;
class FixedDate extends RealDate {
  constructor(value?: string | number | Date) {
    super(value ?? "2026-06-05T16:00:00Z");
  }

  static now() {
    return new RealDate("2026-06-05T16:00:00Z").getTime();
  }
}
(globalThis as typeof globalThis & { Date: DateConstructor }).Date = FixedDate as DateConstructor;

const markup = renderToStaticMarkup(<NewsCalendarView data={payload} />);
const earningsCalendarIndex = markup.indexOf("Earnings Calendar");
const economicCalendarIndex = markup.indexOf("Economic Calendar");
const latestNewsIndex = markup.indexOf("Latest Market News");
assert(
  latestNewsIndex > -1 &&
    economicCalendarIndex > latestNewsIndex &&
    earningsCalendarIndex > economicCalendarIndex,
  "news/calendar layout should render latest news with economic and earnings calendars in the right rail"
);
assert(
  markup.includes("xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.6fr)]") &&
    markup.includes('<aside class="min-w-0 space-y-4"'),
  "news/calendar layout should give the economic calendar wider responsive space"
);
assert(
  /Last Week<\/button>/.test(markup) &&
    markup.includes("rounded-none border border-borderStrong bg-surfaceSubtle") &&
    markup.includes("sm:grid-cols-7") &&
    markup.includes("text-[10px]"),
  "weekday selector buttons should use sharp, equally sized compact styling"
);

assert(markup.includes("Last Week"), "shared selector is missing Last Week");
assert(
  markup.includes("Fri, Jun 5") || markup.includes("Fri Jun 5"),
  "weekday button did not render the selected week date"
);
assert(markup.includes("Next Week"), "shared selector is missing Next Week");
assert(!markup.includes("Selected Day"), "earnings calendar should not render Selected Day label");
assert(
  !markup.includes("Friday, Jun 5"),
  "earnings calendar should not render a selected-day date subtitle"
);
assert(markup.includes("Before Open"), "earnings are not grouped under Before Open");
assert(markup.includes("After Close"), "earnings are not grouped under After Close");
for (const symbol of ["CAP30", "CAP29", "CAP28", "CAP27", "CAP26", "CAP25", "CAP24", "CAP23"]) {
  assert(markup.includes(symbol), `${symbol} should be retained in the top-8 market-cap earnings`);
}
assert(
  !markup.includes("CAP22") &&
    !markup.includes("CAP21") &&
    !markup.includes("CAP20") &&
    !markup.includes("MEGA") &&
    !markup.includes("BIG") &&
    !markup.includes("SMOL") &&
    !markup.includes("OLD"),
  "earnings max-8, market-cap, or selected-day filter failed"
);
assert(
  markup.includes("1.0%") && markup.includes("8.0%"),
  "implied move percentage is not visible"
);
assert(
  !markup.includes("placeholder-logo.svg"),
  "Unusual Whales placeholder logos should not render as images"
);
assert(
  markup.includes("Payrolls") && markup.includes("Core PPI") && !markup.includes("Factory Orders"),
  "economic calendar is not limited to the selected eventDate"
);
assert(markup.includes("9:30 AM ET"), "economic calendar time is not formatted in ET");
assert(
  !markup.includes("Key"),
  "highlighted economic events should not render a visible Key badge"
);
assert(
  markup.includes("bg-accentBlue/10") &&
    markup.includes("shadow-[inset_3px_0_0_rgba(56,189,248,0.95)]"),
  "highlighted economic events should use a notable row-level highlight"
);
assert(
  markup.includes("text-negative") && markup.includes("3.4%"),
  "economic Actual value should receive event-specific red/green tone styling"
);
assert(
  !markup.includes("eventId") && !markup.includes("highlightReason"),
  "economic calendar should not show debug metadata"
);
assert(
  markup.includes("Actual") && markup.includes("Forecast") && markup.includes("Previous"),
  "economic calendar value columns are missing"
);
assert(
  !markup.includes("Importance</th>"),
  "economic calendar should not render textual importance column"
);
assert(!markup.includes("/news-calendar/earnings"), "earnings View All link is still rendered");
for (const hiddenText of [
  "Expected EPS",
  "Actual EPS",
  "Expected Revenue",
  "Actual Revenue",
  "Market Cap",
  "OI",
  "Expected Move",
  "Search ticker/company",
  "S&amp;P 500",
  "Options",
  "Sort:"
]) {
  assert(!markup.includes(hiddenText), `${hiddenText} should not be rendered in the earnings UI`);
}
assert(markup.includes("Market headline 12"), "Latest Market News should render 12 headlines");
assert(
  !markup.includes("Market headline 13"),
  "Latest Market News should not render more than 12 headlines"
);
assert(
  !markup.includes("neutral") && !markup.includes("major") && !markup.includes("PUTIN, DRONES"),
  "news metadata cleanup regressed"
);

const todayData: TodayPayload = {
  ...todayMock,
  marketSummary: [
    { label: "Leading Sectors", value: "Tech", tone: "positive" },
    { label: "Risk On Risk Off", value: "1.10", change: "Risk Off", tone: "neutral" },
    { label: "Put/Call Ratio", value: "0.91", change: "Neutral", tone: "neutral" },
    { label: "Today's Earnings", value: "2 Earnings", tone: "neutral" },
    {
      label: "Today's Economic Events",
      value: "2 Events",
      change: "1 Significant",
      tone: "neutral"
    }
  ],
  economicCalendar: [
    {
      eventDate: "2026-06-05",
      time: "2026-06-05T13:30:00Z",
      timestamp: "2026-06-05T13:30:00Z",
      event: "CPI",
      actual: "3.4%",
      forecast: "3.2%",
      previous: "3.1%",
      importance: "High",
      stars: 3,
      isHighlighted: true
    }
  ]
};
const todayMarkup = renderToStaticMarkup(<TodayView data={todayData} />);
const summaryOrder = [
  "Leading Sectors",
  "Risk On Risk Off",
  "Put/Call Ratio",
  "Today&#x27;s Earnings",
  "Today&#x27;s Economic Events"
].map((label) => todayMarkup.indexOf(label));
assert(
  summaryOrder.every((index) => index > -1),
  "Today Market Summary is missing one of five cards"
);
assert(
  summaryOrder.every((index, position) => position === 0 || summaryOrder[position - 1] < index),
  "Today Market Summary cards are not in the requested order"
);
assert(
  todayMarkup.includes("xl:grid-cols-5"),
  "Today Market Summary should support five responsive cards"
);
const asideMarkup = todayMarkup.slice(todayMarkup.indexOf("Market Overview"));
assert(
  asideMarkup.indexOf("Economic Events") > -1 &&
    asideMarkup.indexOf("Economic Events") < asideMarkup.indexOf("Earnings"),
  "Today tab should render Economic Events above Earnings"
);
assert(
  todayMarkup.includes("bg-accentBlue/10") && !todayMarkup.includes("Key"),
  "Today Economic Events should use non-badge highlight styling"
);
assert(
  !todayMarkup.includes("3.4%") && !todayMarkup.includes("3.2%") && !todayMarkup.includes("3.1%"),
  "Today Economic Events should not show actual, forecast, or previous values"
);

console.log("News & Calendar UI validation passed.");
