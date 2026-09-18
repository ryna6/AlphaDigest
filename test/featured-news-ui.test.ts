import assert from "node:assert/strict";
import test from "node:test";
import { featuredArticleHref } from "../lib/routes/featured-news";
import { compactCalendarDateLabel } from "../components/dashboard/news-calendar/news-calendar-view";
import {
  orderTodayMarketSummary,
  sentimentChangeClass
} from "../components/dashboard/today/today-view";

test("featured article links use one encoded canonical route", () => {
  assert.equal(
    featuredArticleHref("markets & rates"),
    "/overview/today/top-news/markets%20%26%20rates"
  );
});

test("calendar controls use compact month labels with Sept", () => {
  assert.equal(compactCalendarDateLabel("2026-01-05"), "Jan 5");
  assert.equal(compactCalendarDateLabel("2026-09-14"), "Sept 14");
});

test("Today change colors reflect metric sentiment direction", () => {
  assert.equal(sentimentChangeClass("+2.0%", true), "text-positive");
  assert.equal(sentimentChangeClass("-2.0%", true), "text-negative");
  assert.equal(sentimentChangeClass("+2.0%", false), "text-negative");
  assert.equal(sentimentChangeClass("-2.0%", false), "text-positive");
  assert.equal(sentimentChangeClass("0.0%", false), "text-textSecondary");
});

test("Today always renders Economic Events immediately left of right-most Earnings", () => {
  const ordered = orderTodayMarketSummary([
    { label: "Leading Sectors", value: "Tech", tone: "neutral" },
    { label: "Today's Earnings", value: "2 Earnings", tone: "neutral" },
    { label: "Today's Economic Events", value: "3 Events", tone: "neutral" }
  ]);
  assert.deepEqual(
    ordered.map((metric) => metric.label),
    ["Leading Sectors", "Today's Economic Events", "Today's Earnings"]
  );
});
