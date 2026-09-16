# Dashboard delivery architecture

## Audit findings

The public Today, Markets, and News & Calendar pages explicitly used
`force-dynamic` and invoked snapshot-first payload functions on every request.
Flow and Ownership were implicitly dynamic because async server components below
their pages invoked the same functions. Those functions rejected expired snapshots
and synchronously ran builders; the builders can read many normalized tables and,
for Today and Markets, call external providers. They also wrote replacement
snapshots with `refreshedBy: server-fallback`.

No major dashboard route uses authentication or personalized data. The Markets
chart request and economic-calendar date request are interaction-specific and
remain deferred. Ownership's institutional components request a different,
detail-oriented payload and are not duplicates of `ownership:latest`.

The Economy dashboard and `economy:latest` snapshot were intentionally retired by
migration 0041, so there is no `/economy` route to convert.

## Serving path

ISR pages now use `getServingDashboardSnapshot`, which reads exactly one
`dashboard_snapshots` row, validates it, and returns valid expired rows with age,
expiry, stale, and byte-size metadata. It has no builder, provider, or write path.
Missing or invalid rows render a controlled unavailable state. Public dashboard
API routes use the same snapshot-only reader while retaining their CDN headers.

| Route             | Mode |   Revalidate | Snapshot               |
| ----------------- | ---- | -----------: | ---------------------- |
| `/overview/today` | ISR  |   60 seconds | `today:latest`         |
| `/markets`        | ISR  |   60 seconds | `markets:latest`       |
| `/news-calendar`  | ISR  |  180 seconds | `news-calendar:latest` |
| `/flow`           | ISR  |  600 seconds | `flow:latest`          |
| `/ownership`      | ISR  | 1800 seconds | `ownership:latest`     |
| `/sentiment`      | ISR  | 1800 seconds | `sentiment:latest`     |

Time-based ISR remains the fallback. After a snapshot is durably written, the
shared tab registry requests the authenticated `/api/revalidate` route, which
calls `revalidatePath` for the owning page. Configure `ISR_REVALIDATION_SECRET`
on both runtimes; when it is absent, pages still regenerate at the intervals
above. Failed ingestion or snapshot writes never invalidate the last-known-good
page. New normal dashboard tabs opt in by adding their snapshot key, path, and
fallback interval to `lib/data/dashboard-tabs.ts`.

Status is deliberately excluded from this registry and remains `force-dynamic`,
`revalidate = 0`, and `force-no-store` so operational failures are never presented
as static health.

Scheduled Netlify functions remain the only callers of `refreshDashboardSnapshot`
in the production refresh path. The Today snapshot writer removes article
`contentHtml`; article bodies remain in the normalized featured-articles table and
are read only for an opened detail route. Historical market candles likewise
remain loaded only when a chart is opened.
