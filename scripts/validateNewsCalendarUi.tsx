import React from "react";
import path from "node:path";
import Module from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  NewsCalendarPayload,
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

const { NewsCalendarView } =
  require("../components/dashboard/news-calendar/news-calendar-view") as typeof import("../components/dashboard/news-calendar/news-calendar-view");
const { normalizeUnusualWhalesEarningsRow } =
  require("../lib/data/adapters/unusual-whales-earnings") as typeof import("../lib/data/adapters/unusual-whales-earnings");

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
  news: [
    {
      headline: "PUTIN: DRONES HIT A HAVEN IN ST PETERSBURG, THEY REACHED SOME GOALS",
      timestamp: "2026-06-05T16:49:00Z",
      tickers: ["PUTIN", "DRONES", "HAVEN"],
      whyItMatters: "Fixture news item.",
      source: "Tradex",
      publisher: "Tradex",
      sentiment: "neutral",
      major: true
    }
  ],
  economicCalendar: [
    {
      time: "2026-06-05T13:30:00Z",
      event: "Payrolls",
      actual: "TBD",
      forecast: "185K",
      previous: "175K",
      importance: "High"
    },
    {
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

const markup = renderToStaticMarkup(<NewsCalendarView data={payload} />);
const earningsCalendarIndex = markup.indexOf("Earnings Calendar");
const economicCalendarIndex = markup.indexOf("Economic Calendar");
const latestNewsIndex = markup.indexOf("Latest Market News");
assert(
  earningsCalendarIndex > -1 &&
    economicCalendarIndex > earningsCalendarIndex &&
    latestNewsIndex > economicCalendarIndex,
  "calendars should render above latest market news"
);
assert(
  /Last Week<\/button>/.test(markup) &&
    markup.includes("rounded-none border border-borderStrong bg-surfaceSubtle"),
  "weekday selector buttons should use sharp rectangular styling"
);

assert(markup.includes("Last Week"), "shared selector is missing Last Week");
assert(
  markup.includes("Fri, Jun 5") || markup.includes("Fri Jun 5"),
  "weekday button did not render the selected week date"
);
assert(markup.includes("Next Week"), "shared selector is missing Next Week");
assert(!markup.includes("Selected Day"), "earnings calendar should not render Selected Day label");
assert(
  (markup.match(/Friday, Jun 5/g) ?? []).length === 1,
  "economic calendar should not render a date subtitle"
);
assert(markup.includes("Before Open"), "earnings are not grouped under Before Open");
assert(markup.includes("After Close"), "earnings are not grouped under After Close");
for (const symbol of [
  "CAP30",
  "CAP29",
  "CAP28",
  "CAP27",
  "CAP26",
  "CAP25",
  "CAP24",
  "CAP23",
  "CAP22",
  "CAP21"
]) {
  assert(markup.includes(symbol), `${symbol} should be retained in the top-10 market-cap earnings`);
}
assert(
  !markup.includes("CAP20") &&
    !markup.includes("MEGA") &&
    !markup.includes("BIG") &&
    !markup.includes("SMOL") &&
    !markup.includes("OLD"),
  "earnings max-10, market-cap, or selected-day filter failed"
);
assert(
  markup.includes("1.0%") && markup.includes("10.0%"),
  "implied move percentage is not visible"
);
assert(
  !markup.includes("placeholder-logo.svg"),
  "Unusual Whales placeholder logos should not render as images"
);
assert(
  markup.includes("Payrolls") && !markup.includes("Factory Orders"),
  "economic calendar is not limited to the selected day"
);
assert(markup.includes("9:30 AM ET"), "economic calendar time is not formatted in ET");
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
assert(
  !markup.includes("neutral") && !markup.includes("major") && !markup.includes("PUTIN, DRONES"),
  "news metadata cleanup regressed"
);

console.log("News & Calendar UI validation passed.");
