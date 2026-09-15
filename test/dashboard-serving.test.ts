import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { servingSnapshotMetadata } from "../lib/data/adapters/dashboard-snapshots";

test("serving metadata keeps an expired, structurally available snapshot observable", () => {
  const metadata = servingSnapshotMetadata(
    {
      key: "markets:latest",
      payload: { value: 1 },
      mode: "live",
      notices: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:01:00.000Z",
      metadata: {}
    },
    Date.parse("2026-01-01T00:02:00.000Z")
  );

  assert.equal(metadata.stale, true);
  assert.equal(metadata.ageSeconds, 120);
  assert.ok(metadata.payloadBytes > 0);
});

test("public dashboard pages use ISR and the snapshot-only serving module", () => {
  const routes = {
    "app/overview/today/page.tsx": 60,
    "app/markets/page.tsx": 60,
    "app/news-calendar/page.tsx": 180,
    "app/flow/page.tsx": 600,
    "app/ownership/page.tsx": 1800
  };
  for (const [file, seconds] of Object.entries(routes)) {
    const source = readFileSync(file, "utf8");
    assert.match(source, new RegExp(`export const revalidate = ${seconds}`));
    assert.match(source, /getServingDashboardSnapshot/);
    assert.doesNotMatch(
      source,
      /force-dynamic|get(?:Today|Markets|NewsCalendar|Flow|Ownership)Payload/
    );
  }

  const servingSource = readFileSync("lib/data/dashboard-serving.ts", "utf8");
  assert.doesNotMatch(
    servingSource,
    /live-dashboard|fetchYahoo|fetchCrypto|upsertDashboardSnapshot/
  );
});
