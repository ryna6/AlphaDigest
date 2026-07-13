# AlphaDigest Performance Audit

_Date opened: 2026-07-10_

## 1. Executive summary

This audit is evidence-first. The first safe implementation in this branch does **not** rewrite schema, merge tables, change data providers, or move privileged Supabase access into the browser. It adds reproducible measurement tooling, public-cache headers for the existing snapshot-backed dashboard API envelope, and bounded `Server-Timing` instrumentation for the highest-traffic dashboard API routes.

Confirmed from repository inspection:

- AlphaDigest is a Next.js 14.2.23 App Router app deployed by `@netlify/plugin-nextjs` on Netlify and backed by Supabase durable cache/source tables.
- Major dashboard API routes are explicitly `force-dynamic` but most return public, snapshot-backed data from `dashboard_snapshots` through `dashboardJson`.
- `/api/cache/status`, `/status`, ownership detail APIs, and candle chart diagnostics are intentionally `no-store` operational or drill-down endpoints and should not inherit the public snapshot cache policy.
- Browser payload and table-count hypotheses are separate: having many Supabase tables does not itself send more JavaScript, HTML, RSC payload, or JSON to the browser. Only queried and serialized rows affect request payloads.

Production verification is blocked until `PERF_BASE_URL`, Netlify function metrics/log access, and Supabase SQL/metrics access are supplied in the execution environment. The scripts in `scripts/performance/` are designed to capture those measurements without printing secrets.

## 2. Current architecture map

```text
Browser route
  -> Next.js App Router page / route handler on Netlify
  -> dashboard API / Server Component loader
  -> dashboard_snapshots read first for major tabs
  -> live fallback adapter when snapshot is missing/expired/unusable
  -> provider fetch and/or Supabase source table reads
  -> normalized frontend payload
```

Scheduled ingestion path:

```text
Netlify scheduled function
  -> optional background worker
  -> external provider fetch
  -> normalization
  -> Supabase source upsert/prune
  -> dashboard_snapshots upsert
  -> job_runs / data_refresh_metadata telemetry
```

## 3. Production baseline

### Required command

```bash
PERF_BASE_URL=https://<production-host> PERF_RUNS=5 npm exec tsx scripts/performance/measure-routes.ts
PERF_BASE_URL=https://<production-host> PERF_RUNS=5 npm exec tsx scripts/performance/measure-api-payloads.ts
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm exec tsx scripts/performance/snapshot-size-audit.ts
```

### Current branch baseline status

| Measurement | Status | Reason |
| --- | --- | --- |
| Route TTFB/LCP/mobile | Not captured in this environment | No production URL or browser automation target was available. |
| API TTFB/bytes/cache headers | Tooling added; pending production URL | `measure-api-payloads.ts` records TTFB, total duration, payload bytes, envelope mode, cache headers, and `Server-Timing`. |
| Supabase row/table/index sizes | SQL added; pending Supabase SQL access | Read-only SQL is provided for SQL Editor or psql. |
| Snapshot size | Tooling added; pending Supabase env | Uses service-role server-side only and prints only sizes/keys/timestamps. |
| Netlify cold/warm functions | Pending Netlify UI/API logs | Must be compared by first and repeated request plus Netlify function metrics. |

## 4. Route-by-route measurements

Initial target routes:

| Route | Rendering/cache observation | Baseline data source | Measurement status |
| --- | --- | --- | --- |
| `/overview/today` | App route is dynamic. | `/api/today` / `today:latest` snapshot path. | Pending production run. |
| `/markets` | App route is dynamic. | `/api/markets` / `markets:latest` snapshot path plus candle modal API after interaction. | Pending production run. |
| `/news-calendar` | App route is dynamic. | `/api/news-calendar` / `news-calendar:latest`. | Pending production run. |
| `/flow` | Snapshot-backed with additional validation that bypasses stale mock or old flow summary shapes. | `flow:latest`. | Pending production run. |
| `/ownership` | Snapshot-backed top-level payload; client detail cards fetch drill-down APIs. | `ownership:latest` and drill-down tables. | Pending production run. |
| `/economy` | Snapshot-backed through economy payload helper. | `economy:latest`. | Pending production run. |
| `/status` | `force-dynamic`, `revalidate = 0`, `fetchCache = force-no-store`. | `job_runs`/Supabase health. | Should remain no-store. |

## 5. Supabase query inventory

Static source-code inventory highlights:

- Snapshot reads: `dashboard_snapshots.select("key,payload,mode,notices,generated_at,expires_at,source_hash,metadata").eq("key", key).maybeSingle()`.
- Snapshot writes: `dashboard_snapshots.upsert(..., { onConflict: "key" })`.
- Status health: `/api/cache/status` performs exact head counts across cache tables and snapshot payload-size probes; this endpoint is operational and no-store.
- Candle API: resolves configured asset, then reads daily candle rows for API chart ranges. It must remain no-store until a separate candle freshness/cache analysis is completed.
- Flow/ownership drill-down APIs fetch source tables on user interaction and are currently no-store.

Read-only SQL files added:

- `scripts/performance/table-size-audit.sql`
- `scripts/performance/index-usage-audit.sql`
- `scripts/performance/supabase-query-audit.sql`

## 6. Netlify function inventory

Repository deployment docs identify scheduled/manual functions for provider ingestion, source-table writes, snapshot generation, and status telemetry. Netlify metrics still need to be reviewed for cold starts, warm durations, memory, duplicate invocations, and cache status.

## 7. Browser bundle inventory

Dependencies needing route-level bundle review:

| Package | Risk to audit | Expected containment |
| --- | --- | --- |
| `recharts` | Large charting library can inflate client chunks. | Should only load on routes/components with rendered charts. |
| `lightweight-charts` | Chart modal/chart code should not load before chart interaction if avoidable. | Prefer dynamic/lazy import after evidence. |
| `@tanstack/react-table` | Table logic may be heavy for compact summaries. | Confirm route-specific inclusion. |
| `lucide-react` | Icons should tree-shake when imported individually. | Confirm bundle analyzer output. |
| `zod` | Validation should stay server/API-side unless needed client-side. | Confirm schemas are not pulled into broad client chunks. |
| `date-fns` | Watch shared chunk impact. | Prefer per-function imports if needed. |

Run bundle analysis after installing/using an analyzer or parse `.next` output:

```bash
npm run build
find .next/static/chunks -type f -name '*.js' -maxdepth 3 -print0 | xargs -0 wc -c | sort -n
```

## 8. Snapshot and cache inventory

Expected dashboard snapshot keys:

- `today:latest`
- `markets:latest`
- `news-calendar:latest`
- `flow:latest`
- `ownership:latest`
- `economy:latest`

Implemented in this branch:

- Snapshot-backed dashboard APIs using `dashboardJson` now emit explicit `Cache-Control`, `CDN-Cache-Control`, and `Netlify-CDN-Cache-Control` headers with `stale-while-revalidate` and Netlify durable cache semantics.
- Operational/no-store endpoints are left unchanged.
- `Server-Timing` is emitted by selected dashboard APIs so production measurements can separate payload build time from transfer time.

## 9. External-provider dependency map

Normal page requests should prefer snapshots and cached source tables. Provider calls are concentrated in adapters and Netlify functions for Yahoo Finance, Finnhub, CoinGecko, Unusual Whales, Investing.com calendar, CBOE, FRED/economy, Barchart/market breadth, and ownership/congressional data. Any provider call observed during ordinary dashboard navigation is a candidate P1/P0 unless it is a documented live fallback after missing/expired snapshot.

## 10. Research sources

### Official Netlify

- Netlify Next.js docs: current Netlify support includes App Router, Server Components/Streaming, Full Route Cache, Data Cache, tag/path revalidation, and Image CDN support.
- Netlify caching overview / Cache API: durable cache works with normal cache-control, stale-while-revalidate, and invalidation; fine-grained headers can be applied to function responses.
- Netlify scheduled/background function docs should be used to validate dispatcher/worker behavior and timeout risk in Netlify UI logs.

### Official Supabase

- Supabase Query Optimization: indexes should match actual query patterns; indexes are not automatic and should be justified by plans/frequency.
- Supabase Debugging/Monitoring: use `EXPLAIN`; use `EXPLAIN ANALYZE` carefully because it executes the statement.
- Supabase Database Advisors and `pg_stat_statements`: use built-in advisors and statement statistics for slow/frequent query evidence.
- Supabase Performance docs: distinguish unoptimized SQL from platform resource limits.
- Data API / `supabase-js` route: this app uses PostgREST/Data API calls via `@supabase/supabase-js`, not a direct Postgres client. Supavisor/direct connection guidance is not automatically applicable to this request path.

### Official Next.js

- Next.js 14 App Router caching docs: Full Route Cache applies to statically rendered routes; Router Cache stores RSC payloads in the browser; `force-dynamic` opts out of Full Route Cache and request-time renders.
- Next.js route handlers docs: route handlers use Web Request/Response APIs and are controlled by route segment config and response headers.
- Next.js package bundling docs: use bundle analyzer and route-level chunks to validate large-package hypotheses.
- Next.js dynamic imports/lazy loading docs: dynamic import is appropriate for heavy interaction-only components after bundle evidence.

### GitHub project references to inspect before Stage B/C changes

| Repository | Commit/version inspected | Relevant paths | Pattern observed | Applies? | Caveat |
| --- | --- | --- | --- | --- | --- |
| `netlify-templates/next-netlify-starter` | Current GitHub default as of 2026-07-10 search | `netlify.toml`, App Router files | Minimal Netlify Next app using plugin/runtime conventions. | Confirms deployment shape. | Too small for dashboard caching decisions. |
| `netlify-templates/next-platform-starter` | Current GitHub default as of 2026-07-10 search | App Router, Netlify primitives | Demonstrates explicit Netlify primitives with modern App Router. | Useful for durable/cache primitive patterns. | Next 16, not exact Next 14.2.23. |
| `opennextjs/opennextjs-netlify` | Current GitHub default as of 2026-07-10 search | runtime package/docs | Netlify adapter/runtime handles Next features; normally not installed manually. | Supports not replacing runtime. | Runtime internals differ from app code. |
| `vercel/next.js/examples/with-supabase` | `canary` README as found | Supabase client patterns | Official example separates server/client Supabase concerns. | Reinforces keeping service role server-only. | Auth-focused, not analytics dashboard. |
| `calcom/examples` | Current GitHub default as of 2026-07-10 search | `with-nextjs-14`, Supabase platform examples | Server endpoints wrap third-party/platform APIs rather than exposing keys. | Relevant to provider isolation. | Scheduling domain, not market data. |
| `plausible/analytics` | Current GitHub default as of 2026-07-10 search | Analytics/dashboard architecture | Data-heavy analytics systems preaggregate/cache for dashboards. | Conceptually supports snapshot-first dashboard payloads. | Elixir/ClickHouse stack, not Next/Supabase. |

## 11. Hypotheses tested

| Hypothesis | Evidence so far | Status |
| --- | --- | --- |
| Public snapshot APIs lack explicit Netlify CDN cache headers. | `dashboardJson` only set `Cache-Control: s-maxage=60, stale-while-revalidate=300`; Netlify docs support CDN-specific headers. | Confirmed low-risk improvement. |
| Operational status APIs are slow but cacheable. | Source shows no-store and live telemetry; caching would weaken correctness. | Rejected. |
| Table count directly increases browser JavaScript. | Browser JS comes from client imports/chunks, not database table count. | Rejected. |
| Table count may affect request performance through repeated reads/round trips or maintenance overhead. | Source has multiple table domains and snapshots; SQL metrics pending. | Unconfirmed, needs Supabase evidence. |
| Supabase client creation dominates latency. | Not measured; helper creates a new client per call. | Pending; do not change yet. |
| Candle tables should be merged. | No query plans/row counts yet; docs say candle retention has specific behavior. | Rejected for Stage A; revisit only after table-size/query-plan evidence. |

## 12. Bottlenecks confirmed

P1 confirmed:

1. **Insufficient response-level observability for dashboard APIs.** There was no per-route `Server-Timing` header to correlate API build time with TTFB/transfer.
2. **Snapshot-backed public dashboard APIs did not express Netlify-specific CDN caching.** Generic `s-maxage` may work, but Netlify docs support `CDN-Cache-Control` and `Netlify-CDN-Cache-Control` for clearer CDN behavior and durable cache.

## 13. Bottlenecks rejected

- **“Fewer Supabase tables will reduce browser payload.”** Rejected unless a measured request fetches/serializes those tables. Browser payload is determined by HTML/RSC/JS/API bytes, not table count.
- **Caching `/status` and `/api/cache/status` publicly.** Rejected because status telemetry is intentionally fresh/no-store.
- **Replacing Supabase Data API with direct Postgres connection.** Rejected for this stage; current path is `supabase-js` Data API and no evidence shows connection overhead dominates.
- **Adding broad speculative indexes.** Rejected until query plans and frequency prove value.

## 14. Recommended changes

Implemented now:

1. Add reusable bounded performance spans and `Server-Timing` support.
2. Add `Server-Timing` to `/api/today`, `/api/markets`, `/api/news-calendar`, `/api/flow`, and `/api/economy`.
3. Add Netlify-aware public CDN headers only to the existing dashboard API envelope.
4. Add production-safe benchmark scripts and Supabase audit SQL.

Recommended next after production data:

1. Run route/API scripts against production and deploy preview.
2. Run snapshot/table/index/query SQL in Supabase.
3. Use Netlify function metrics to classify cold/warm and cache status.
4. Run bundle analysis and dynamically import only confirmed interaction-only heavy modules.
5. Add indexes or query rewrites only where `EXPLAIN` and frequency justify them.

## 15. Changes not recommended

- Table consolidation in Stage A.
- Direct Postgres/Supavisor migration for route handlers.
- Redis or paid cache dependency.
- Public caching for status/detail/no-store endpoints.
- Long-lived caching of error responses.
- Replacing provider data with fixtures for speed.

## 16. Table-consolidation conclusion

**Keep current table structure.**

Evidence:

- No measurement yet shows that table count increases browser JS, HTML/RSC, or API JSON bytes.
- Snapshot-backed tabs usually read one `dashboard_snapshots` row, so table count is hidden from ordinary navigation when snapshots are fresh.
- Candle tables have different domains/retention and correctness requirements, including futures/crypto calendar behavior.
- Consolidation would require discriminator columns, larger composite indexes, mixed retention rules, RLS/policy review, migration/rollback plans, and write-cost benchmarking.

Revisit consolidation only after a production SQL audit shows one of these thresholds:

- repeated route-time reads across many similarly-shaped tables add >150 ms median server duration on a high-traffic route;
- duplicated indexes/schema maintenance consume material storage or write time relative to actual row counts;
- snapshot-building complexity or write amplification becomes a confirmed scheduled-job bottleneck;
- a benchmarked consolidated prototype beats current query latency, index size, insert/upsert time, pruning time, and rollback complexity.

## 17. Implementation order

| Priority | Candidate | Evidence | Risk | Decision |
| --- | --- | --- | --- | --- |
| P1 | Public CDN headers for snapshot dashboard APIs | Existing public snapshot envelope plus Netlify docs | Low | Implemented. |
| P1 | Server-Timing for major APIs | Missing observability blocks proof | Low | Implemented. |
| P1 | Production route/API benchmark scripts | Required for before/after | Low | Implemented. |
| P2 | Snapshot/table/index SQL audits | Required before DB changes | Low/read-only | Implemented as scripts. |
| P2 | Dynamic import heavy chart modal | Needs bundle data first | Low/medium | Defer. |
| P3 | Supabase client reuse | No timing evidence yet | Medium | Defer. |
| Rejected | Merge candle tables now | No measured route/payload gain | High | Reject. |

## 18. Rollback plan

- Revert `lib/api/response.ts` to previous single `Cache-Control` header if Netlify cache behavior is incorrect.
- Remove `Server-Timing` imports/calls from API routes and delete `lib/observability/performance.ts` if instrumentation causes unexpected issues.
- Remove `scripts/performance/` if the measurement approach is replaced.
- No schema migrations were added; no database rollback is required for this branch.

## 19. Before-and-after results

### Code-level before/after

| Area | Before | After | Expected effect | Production result |
| --- | --- | --- | --- | --- |
| Snapshot dashboard API cache headers | `Cache-Control: s-maxage=60, stale-while-revalidate=300` | Adds explicit public browser/CDN/Netlify CDN headers and durable SWR semantics | Higher probability of CDN hits and clearer cache behavior for public snapshot APIs | Pending deploy-preview/production measurement. |
| API observability | No `Server-Timing` on major dashboard APIs | `Server-Timing` includes total payload span and payload mark | Separates server build time from network transfer | Pending production measurement. |
| Bench tooling | Manual/ad hoc | Deterministic JSON scripts and read-only SQL | Reproducible baselines | Pending run with production credentials. |

### Reproduction commands

```bash
PERF_BASE_URL=https://<production-host> PERF_RUNS=5 npm exec tsx scripts/performance/measure-routes.ts > perf-routes-before.json
PERF_BASE_URL=https://<production-host> PERF_RUNS=5 npm exec tsx scripts/performance/measure-api-payloads.ts > perf-api-before.json
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm exec tsx scripts/performance/snapshot-size-audit.ts > perf-snapshots-before.json
```

Run the SQL files in Supabase SQL Editor or a read-only psql session. Do not paste service-role keys into browser code or logs.

## 16. 2026-07-12 continuation: Today-first loading

Repository changes now make `/overview/today` the critical route. Visible navigation links set `prefetch={false}` so the Today shell does not compete with eager prefetches for Markets, News & Calendar, Flow, Ownership, Economy, Sentiment, or Status during hydration. The shared dashboard shell mounts a client-side deferred prefetcher that waits for the browser load event (or an already-complete document), an idle callback/fallback timer, and an additional quiet period before warming one route at a time in this order: Markets, News & Calendar, Flow, Ownership, Economy, Sentiment, Status.

The prefetcher reads the central navigation configuration, excludes the active route, deduplicates warmed routes during the browser session, pauses on hidden documents, and skips background work when Save-Data, `slow-2g`, or `2g` is detected. Hover, keyboard focus, pointer down, or touch start can prioritize a user-selected route without blocking navigation. In production, `router.prefetch()` should be treated as warming route code/RSC/loading boundaries only unless network traces prove that reusable snapshot data is warmed; it must not trigger provider refreshes from the browser.

Production browser measurements remain pending because this execution environment was not provided `PERF_BASE_URL`, a deployed preview URL, Netlify logs, or Supabase metrics access. Use the commands in §3 with the same browser/network/cache profile before and after deploy.

## 17. Loading feedback and navigation progress

Primary dashboard routes now have App Router loading boundaries backed by reusable skeleton components. The persistent shell includes a thin, `pointer-events-none` progress indicator with `aria-live="polite"` and `aria-busy="true"`; it clears when the pathname changes or after a failure timeout. The indicator does not cover the page, disable body pointer events, or block mobile/desktop navigation.

## 18. Schedule corrections

Netlify Scheduled Functions documentation states cron expressions run in UTC. Because native timezone-aware schedules were not documented, AlphaDigest uses the UTC fallback schedules:

- Daily Market Candles: `0 23 * * 1-5`, once Monday-Friday. This is 6:00 PM America/Toronto during standard time and 7:00 PM during daylight time.
- Daily Crypto Candles: `0 6 * * *`, once daily. This is 1:00 AM America/Toronto during standard time and 2:00 AM during daylight time.

The old dual market wake plus 6:30 PM Toronto guard and the old 6:45 PM crypto schedule are removed. Manual Netlify Run now still classifies invocations without `next_run` as manual and propagates `manual: true` to the market background worker.

## 19. Ownership latest-complete 13F selection

Tracked institutional ownership now selects the latest complete report period per institution. Completeness requires an institution summary/info row, a valid report date, and at least one stock holding for the same report date. Activity and options are optional and cannot erase a complete stock filing. If a newer provider period exists without holdings, the UI serves the previous complete filing and reports safe metadata: latest available report date, latest provider report date, selected dates by institution, fallback institution count, incomplete newer periods, and fetched timestamp.

For July 12, 2026 fixtures, March 31, 2026 is selected when June 30, 2026 has no complete holdings. Holdings are grouped by institution, the selected complete period is determined before sorting, and displayed top holdings are filtered to that exact report date to prevent quarter mixing.

## Market Watch and structural loading update

Market Watch is calculated during the `markets:latest` snapshot build from cached `sp500_daily_candles`, not browser quote requests, mock rows, TradingView data, or heatmap percentage changes. A symbol is eligible only when its latest valid OHLC candle is on the latest common S&P 500 candle date; older latest candles are reported as stale. `52W Highs` compares the latest high with the maximum high from the previous 252 valid trading sessions, explicitly excluding the latest candle. `52W Lows` compares the latest low with the minimum low from the previous 252 valid trading sessions, also excluding the latest candle. `200D MA Crosses` require 201 valid daily closes and only emit crossed-above, crossed-below, or exact-at signals using the previous and current 200-session averages. `200W MA Crosses` are derived from weekly observations built from the final valid daily close in each market week and require 201 weekly closes; if stored history is insufficient, the section remains visible with an insufficient-history reason and coverage metadata rather than fabricated signals. Proximity thresholds and mock Market Watch rows are intentionally not used.

Application loading now uses a single structural-shell architecture. `components/loading/route-shell-registry.tsx` maps direct URLs, nested routes, and dynamic route families to lightweight shells under `components/loading/shells/`. Route `loading.tsx` files reuse the same shells for direct visits, refreshes, Back, and Forward. The persistent shell can show the destination skeleton immediately on internal navigation while Next.js resolves the route. The top loading bar starts on internal route activation, is not cleared merely by pathname change, and uses navigation IDs plus a bounded safeguard timeout so superseded navigations cannot clear newer ones. Modal/local async surfaces, including market candle charts, open their frame immediately and reserve controls/chart space while local data fetches complete. Shells avoid Supabase clients, provider adapters, Zod server schemas, chart libraries, article bodies, and fixture datasets so the initial bundle budget remains small; measured bundle impact should be checked with `npm run build` for each release.
