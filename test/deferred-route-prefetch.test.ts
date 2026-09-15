import assert from "node:assert/strict";
import test from "node:test";
import { canBackgroundPrefetch, orderedPrefetchRoutes } from "../components/shell/deferred-route-prefetch";

test("deferred prefetch excludes current route and orders utility routes last", () => {
  const routes = orderedPrefetchRoutes("/overview/today");
  assert.deepEqual(routes.slice(0, 5), ["/markets", "/news-calendar", "/flow", "/ownership", "/sentiment"]);
  assert.equal(routes.includes("/overview/today"), false);
  assert.equal(routes.at(-1), "/status");
});

test("deferred prefetch respects constrained networks and hidden documents", () => {
  assert.equal(canBackgroundPrefetch({ connection: { saveData: true }, visibilityState: "visible" }), false);
  assert.equal(canBackgroundPrefetch({ connection: { effectiveType: "2g" }, visibilityState: "visible" }), false);
  assert.equal(canBackgroundPrefetch({ connection: { effectiveType: "slow-2g" }, visibilityState: "visible" }), false);
  assert.equal(canBackgroundPrefetch({ connection: { effectiveType: "4g" }, visibilityState: "hidden" }), false);
  assert.equal(canBackgroundPrefetch({ connection: { effectiveType: "4g" }, visibilityState: "visible" }), true);
});
