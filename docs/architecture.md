# Architecture

This document describes the current AlphaDigest implementation. Treat the codebase as the source of truth and update this file when architecture, routing, data flow, or shared patterns change.

## Stack

- **Framework:** Next.js 14 App Router.
- **Language:** TypeScript.
- **UI:** React server components for page-level data fetches, client components where interactivity is needed.
- **Styling:** Tailwind CSS with custom dark-dashboard tokens.
- **Validation:** Zod schemas for internal API response envelopes.
- **Persistence:** Optional Supabase tables for supported cache/refresh flows.
- **Hosting target:** Netlify with `@netlify/plugin-nextjs` and functions in `netlify/functions/`.

## Top-level structure

```text
app/                         App Router pages and API routes
components/dashboard/        Feature-level dashboard views
components/shell/            Sidebar, logo, layout shell
components/ui/               Shared presentational primitives
lib/api/                     API response helpers
lib/constants/               Navigation and asset-icon maps
lib/data/                    Data orchestration, schemas, fixtures, adapters
lib/db/                      Supabase client factory
lib/utils/                   Formatting, class-name, and time helpers
netlify/functions/           Netlify serverless and scheduled functions
public/assets/heatmap-icons/ Static icons used in metric strips and heatmaps
public/data/                 Static fallback data files
scripts/                     Local maintenance and validation scripts
supabase/                    Schema and migrations
```

## Routing model

### User pages

| Route                             | Purpose                                                | Main component/data source                                                   |
| --------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `/`                               | Redirects to Today.                                    | `app/page.tsx` redirects to `/overview/today`.                               |
| `/overview/today`                 | Daily briefing.                                        | `getTodayPayload()` and `TodayView`.                                         |
| `/overview/today/top-news`        | Paginated featured article list.                       | `getTodayPayload()` and `TopNewsListClient`.                                 |
| `/overview/today/top-news/[slug]` | Featured article detail.                               | Today featured article payload.                                              |
| `/markets`                        | Market strip and heatmaps.                             | `getMarketsPayload()` and `MarketsView`.                                     |
| `/news-calendar`                  | Latest news, economic calendar, and earnings calendar. | `getNewsCalendarPayload()` and `NewsCalendarView`.                           |
| `/news-calendar/news`             | Expanded latest-news list.                             | `AllNewsView`.                                                               |
| `/news-calendar/earnings`         | Expanded earnings calendar.                            | `AllEarningsView`.                                                           |
| `/flow`                           | Flow dashboard.                                        | `getFlowPayload()` reads `flow:latest`, Flow source tables, then fixtures.   |
| `/ownership`                      | Ownership dashboard.                                   | `ownershipMock` fixture / optional `ownership:latest`.                       |
| `/flow-ownership`                 | Legacy redirect.                                       | Redirects to `/flow`.                                                        |
| `/economy`                        | Economy dashboard.                                      | `getEconomyPayload()` and `EconomyView`.                                     |
| `/sentiment`                      | Sentiment dashboard.                                    | `SentimentView` fixture-backed sentiment metrics.                            |
| `/sentiment/market-expectations`  | Sentiment subpage placeholder.                          | `MarketExpectationsView`.                                                    |
| `/economy-sentiment`              | Legacy compatibility redirect retained to avoid breaking old links. | Redirects to `/economy`; retained intentionally because it is a public route path. |
| `/sources-methodology`            | Source reference table.                                | Static page-level source list.                                               |
| `/status`                         | Job/component monitoring page.                         | Server-rendered status rows from `lib/status/jobs.ts` and Supabase metadata. |
| `/settings`                       | Legacy redirect.                                       | Redirects to `/status`.                                                      |

The Status page groups automated jobs by dashboard tab and uses `lib/status/jobs.ts` as the central registry for user-facing names, Netlify function/job names, metadata keys, confirmed schedules, and freshness windows. Its visible columns are Job, Status, Source, Schedule, Last Run, and Next Run, with the Status content center-aligned and Source limited to short safe provider names. Last Run and health use fresh Supabase `job_runs` telemetry queried at request/refetch time as the source of truth; Next Run is calculated from the registry schedule rule when the automatic schedule is known. Status times are rendered with America/Toronto calculations under the page-level note “All times are shown in Eastern Standard Time.” rather than per-cell ET/EST/EDT suffixes. Netlify cron wakes in UTC for several jobs, so `lib/schedule/toronto.ts` guards provider fetches inside the intended Eastern/Toronto windows without fixed EST offsets. `refresh-news-feed` runs every 30 minutes every day on the hour and half-hour. Flow source jobs run hourly Monday-Friday where guarded, while `refresh-flow` wakes at five minutes after the hour and runs inside the Monday-Friday Toronto guard to support source-to-snapshot sequencing. TBD rows represent planned or unimplemented jobs and remain Unknown until a real schedule and metadata source exist.

Navigation items live in `lib/constants/navigation.ts`. The desktop sidebar and mobile horizontal tab bar mark an item active when the current path exactly matches or starts with the item's `href`.

### Internal API routes

All API responses that use `dashboardJson()` are wrapped with:

- `payload`
- `mode`
- `notices`
- `timezone`
- `generatedAt`

| Route                                         | Current behavior                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `/api/today`                                  | Calls `getTodayPayload()` and validates with `todayPayloadSchema`.                      |
| `/api/markets`                                | Calls `getMarketsPayload()` and validates with `marketsPayloadSchema`.                  |
| `/api/news-calendar`                          | Calls `getNewsCalendarPayload()` and validates with `newsCalendarPayloadSchema`.        |
| `/api/news-calendar/economic?date=YYYY-MM-DD` | Fetches an economic-calendar week for the requested date and returns normalized events. |
| `/api/uw-earnings`                            | Frontend-safe earnings endpoint around `getCachedUnusualWhalesEarnings()`.              |
| `/api/flow`                                   | Reads `flow:latest`, source Flow tables, then fixtures.                                 |
| `/api/ownership`                              | Returns Ownership fixture/snapshot payload.                                             |
| `/api/flow/insider-trades`                    | Returns up to top 50 cached insider company aggregates.                                 |
| `/api/flow/insider-trades/[ticker]`           | Returns cached insider detail rows for one ticker.                                      |
| `/api/flow-ownership`                         | Legacy redirect to `/api/flow`.                                                         |
| `/api/economy`                                | Calls `getEconomyPayload()` and validates with `economyPayloadSchema`.                 |
| `/api/economy-sentiment`                      | Legacy compatibility endpoint that re-exports `/api/economy`; retained to avoid breaking old clients. |
| `/api/sources/status`                         | Returns configured/missing booleans for environment variables, never secret values.     |

## Data orchestration

The main orchestration module is `lib/data/live-dashboard.ts`.

### Markets payload

`getMarketsPayload()`:

1. Starts with `marketsMock()` as a complete fallback.
2. Attempts live quote fetches for heatmap groups: Finnhub for global markets, sectors, and macro; CoinGecko for the centralized crypto heatmap dataset.
3. Attempts strip metrics for SPY, QQQ, IJH, IWM through Finnhub and S&P 500 futures through Yahoo Finance.
4. Uses fallback tiles/metrics when individual live values fail.
5. Returns `mode: "mock"` only when no live heatmap or strip data is available.

### Today payload

`getTodayPayload()`:

1. Calls `getMarketsPayload()` and reuses sector heatmap data to derive leading sectors.
2. Fetches VIX from the existing Yahoo Finance VIX flow and VIX3M from Yahoo Finance `^VIX3M`, then computes `VIX3M / VIX` only when both positive index levels are available.
3. Reads the latest Cboe Total put/call observation from Supabase when configured, otherwise performs a server-side Cboe fetch/parse with no synthetic fallback.
4. Fetches featured Unusual Whales articles.
5. Gets cached/live/fallback Unusual Whales earnings and filters them to today's major earnings.
6. Fetches today's Investing.com economic calendar events.
7. Fetches market overview metrics for S&P 500, Nasdaq 100, WTI oil, gold, Bitcoin, and VIX.
8. Merges live data with `todayMock` fallback fields.

### News & Calendar payload

`getNewsCalendarPayload()`:

1. Fetches the Unusual Whales headline feed.
2. Loads a fallback earnings snapshot with company logos from Finnhub profile calls when needed.
3. Gets cached/live/fallback Unusual Whales earnings for the selected calendar range.
4. Fetches economic events for the previous/current/next adjacent weeks.
5. Returns news, economic events, compact earnings rows, full Unusual Whales earnings rows, earnings metadata/message, and source metadata.

The News & Calendar economic calendar also performs client-side selected-date fetches against `/api/news-calendar/economic` when a date is missing from the initially hydrated event buckets.

## Adapter layer

Adapters under `lib/data/adapters/` isolate provider-specific behavior:

- `finnhub-key-router.ts` maps feature areas to their dedicated Finnhub environment variables.
- `yahoo-finance.ts` reads public Yahoo chart/quote endpoints and includes Supabase refresh/cache helpers for selected symbols.
- `unusual-whales-news.ts` fetches featured articles and headline feed data; it also includes optional Supabase refresh/cache helpers.
- `unusual-whales-earnings.ts` fetches, normalizes, caches, and falls back for earnings calendar data.
- `investing-economic-calendar.ts` fetches and normalizes Investing.com economic calendar events; it also includes optional Supabase refresh/cache helpers.
- `commodity-prices-adapter.ts` is a placeholder strategy/mock helper, not an active live commodity integration.
- `market-data-provider-adapter.ts` documents a generic provider placeholder pattern.
- `supabase-refresh.ts` contains shared content-hash and metadata-upsert helpers.

## Supabase usage

`createServerSupabaseClient()` returns an unavailable result unless both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured. The service role key is server-only.

Supabase-backed code currently exists for:

- Unusual Whales earnings events.
- Unusual Whales news feed and featured articles.
- Investing.com economic events.
- Yahoo market quotes.
- Shared `data_refresh_metadata` change detection.

The app does **not** require Supabase to render. In particular, earnings can fall back to live server fetches, in-memory cache, and static JSON.

## Netlify functions

Active earnings functions:

- `fetch-uw-earnings.ts`: scheduled every 6 hours daily (`0 */6 * * *`) where Netlify scheduled functions are supported; refreshes optional Supabase earnings cache for Monday of the previous week through Friday of the next week based on the Toronto/Eastern date.
- `get-uw-earnings.ts`: frontend-safe serverless getter for filtered cached/live/fallback earnings.

Placeholder functions:

- `refresh-today.ts`
- `refresh-news.ts`
- `refresh-markets.ts`
- `refresh-flow.ts`
- `refresh-economy.ts`
- `refresh-sources-status.ts`

The placeholder functions only return JSON that describes future ingestion flow. Do not document them as active refresh pipelines until they are implemented.

## Static assets and fallback files

- Heatmap and metric icon images are stored in `public/assets/heatmap-icons/`.
- Icon resolution is centralized in `lib/constants/asset-icons.ts`; do not hard-code icon paths in components.
- `public/data/unusual-whales/earnings-calendar.json` is the static fallback for earnings calendar data.

## Styling system

- Global styles and font import live in `app/globals.css`.
- Tailwind custom colors and `Space Grotesk` font configuration live in `tailwind.config.ts`.
- Core visual primitives are intentionally square/compact: `Panel`, `MetricRow`, `DataTable`, `Heatmap`, `SectionHeader`, `InfoTooltip`, `ErrorState`, and `EmptyState`. `SectionHeader` is the shared high-level card/container title style and should stay larger than nested KPI labels.
- Large layouts generally use responsive grids with `xl:` breakpoints and mobile-first stacking.
- The desktop sidebar is sticky at the viewport top, and below `lg` a sticky mobile header exposes the primary tabs in a horizontally scrollable tab bar.

## Known architecture limitations

- Several pages remain fixture-backed even though source/methodology pages list future intended providers.
- `refresh-put-call.ts`: wakes every 30 minutes on the hour and half-hour Monday through Friday (`*/30 * * * 1-5`).
- Many refresh helpers are implemented at the adapter level but are not wired to scheduled Netlify functions.
- Source pages and settings pages are mostly static references and may drift unless maintained with code changes.
- The app has no formal unit-test suite beyond typecheck and the custom News & Calendar UI validation script.

## Supabase-first dashboard snapshots

AlphaDigest remains fully web-hosted/serverless: GitHub stores code, Netlify hosts the Next.js app and runs scheduled/serverless functions, and Supabase Cloud hosts Postgres. The active dashboard tab payloads now use `dashboard_snapshots` as the primary read path before live provider calls.

- `/api/today`, `/overview/today`, and top-news detail routes call `getTodayPayload()`, which first reads `today:latest` from Supabase when configured and fresh.
- `/api/markets` and `/markets` call `getMarketsPayload()`, which first reads `markets:latest`.
- `/api/news-calendar` and the News & Calendar pages call `getNewsCalendarPayload()`, which first reads `news-calendar:latest`.
- If Supabase is missing, the snapshot is absent/stale, or the snapshot read fails, the existing live/fixture fallback builders still run. This preserves local development and prevents blank pages.
- Netlify scheduled functions `refresh-today`, `refresh-markets`, and `refresh-news` build the same frontend-ready payloads server-side and upsert them into Supabase.
- Browser/client components do not write to Supabase. The service role key is only consumed by server-only code through `createServerSupabaseClient()`.

`dashboard_snapshots` stores compact, frontend-ready JSON keyed by values such as `today:latest`, `markets:latest`, and `news-calendar:latest`. Normalized source tables remain useful where adapters already write them, but dashboard tabs should not need to wait on each source during normal navigation.

### Failure-focused cache corrections

The source-specific cache tables are now backed by an additive migration, not only by `supabase/schema.sql`. Scheduled source refreshes are separated from dashboard snapshot refreshes so Netlify can populate normalized rows before users navigate:

- `refresh-news-feed` writes `unusual_whales_news_feed`.
- `refresh-featured-articles` writes `unusual_whales_featured_articles`, including the required `created_at_source` column; `image_url` is no longer cached or rendered.
- `refresh-economic-events` writes `investing_economic_events`.
- `refresh-market-quotes` writes `market_quotes`.
- `refresh-today`, `refresh-markets`, and `refresh-news` also write `dashboard_snapshots` keys used by the active tabs.

Source refresh helpers upsert fetched rows even when content hashes match existing metadata. This prevents a false-success state where metadata says rows were fetched but production tables are empty after a migration, truncate, or failed earlier write.

## Supabase durable cache contract

The production architecture remains serverless: GitHub stores code, Netlify hosts the Next.js frontend and scheduled/serverless functions, and Supabase Cloud hosts Postgres. Netlify functions fetch providers and upsert normalized source rows, then dashboard refresh jobs write frontend-ready `dashboard_snapshots`. The browser never receives `SUPABASE_SERVICE_ROLE_KEY`; server code and Netlify functions perform privileged cache writes.

The current cache contract is captured by migrations through `0007_fix_cache_schema_mismatches.sql` and the pasteable production repair file `supabase/manual/apply-cache-schema-fix.sql`. Active write flows include `data_refresh_metadata`, `investing_economic_events`, `market_quotes`, `unusual_whales_earnings_events`, `unusual_whales_featured_articles`, `unusual_whales_news_feed`, `put_call_observations`, and `dashboard_snapshots`. `/api/today`, `/api/markets`, and `/api/news-calendar` read fresh snapshots first, fall back to live server-side providers when needed, and may return stale snapshots only if live fallback fails.

## Flow/Ownership cache architecture

The former `/flow-ownership` product area is split into `/flow` and `/ownership`; `/flow-ownership` redirects safely to `/flow`. Netlify scheduled functions fetch the provided Unusual Whales dark-pool and insider endpoints server-side, upsert normalized rows into Supabase Cloud, and write `flow:latest` dashboard snapshots. No browser/client component calls Unusual Whales or receives `SUPABASE_SERVICE_ROLE_KEY`.

Flow reads `flow:latest` first only when the snapshot is non-mock and includes current 6-month insider diagnostics, then source tables `unusual_whales_dark_pool_flows`, `unusual_whales_whale_feed`, and `unusual_whales_insider_trades`, then section-level fixtures. Ownership may read `ownership:latest`, but its Congressional sections remain fixture-backed while Institutional uses the tracked-institution cache because no live endpoints were provided. This preserves the GitHub + Netlify + Supabase serverless architecture with no self-hosted services, Docker, production Node server, or always-on backend.

### Flow refresh integrity

Flow ingestion preserves the GitHub + Netlify + Supabase Cloud architecture: Netlify functions fetch Unusual Whales server-side, upsert only normalized fields into Supabase, and frontend/page APIs read `flow:latest` or source tables before fixture fallback. The dark-pool adapter now detects common response shapes (`$`, `data`, `trades`, `results`, `rows`, `items`, `data.rows`, `data.items`, `data.results`, `data.trades`) and records safe diagnostics without logging secrets or full raw payloads. Insider rows are assigned deterministic IDs from provider IDs when available, otherwise from canonical transaction fields, then deduped before `onConflict: "external_id"` upserts. Partial Flow snapshots are allowed only with explicit source status and notices.

### Flow routes and timestamp display

Flow now has expanded section routes for `/flow/dark-pool`, `/flow/whale-feed`, and `/flow/insider-trades`, plus ticker drilldowns for insider trades and dark-pool prints. These pages continue to read through server-side dashboard loaders/API paths backed by Supabase snapshots/source tables and fixture fallback. Dark Pool and Insider Trades data remain server-side cached; Whale Feed reads its Supabase source table/snapshot when rows exist and only falls back to fixtures when no real rows are available.

Dashboard-facing Flow date/time rendering uses explicit Eastern Time (`America/Toronto`) helpers and labels values as `ET`. This is a presentation-layer choice only; Supabase timestamp columns continue to store UTC/timestamptz values, and Netlify/platform logs can remain UTC.

### Flow mock snapshot bypass

The Flow dashboard keeps snapshot-first behavior for real cached payloads, but it no longer lets a fresh mock `flow:latest` snapshot mask real Supabase source rows. If the snapshot mode is `mock`, `getFlowPayload()` rebuilds from `unusual_whales_dark_pool_flows` and `unusual_whales_insider_trades` and persists a replacement snapshot only when the rebuilt payload is live. This preserves fallback behavior without allowing fixture rows to override real cache data.

### Flow route and summary behavior

The app shell navigation uses lucide monochrome SVG icons for core tabs, including Today `Newspaper`, Markets `TrendingUp`, Economy `ChartColumn`, and Sentiment `Vote`, so these tabs do not rely on emoji glyphs or grayscale emoji filters. The Economy tab has 3 compact derived summary cards and 6 FRED-backed main categories shown one at a time behind a segmented selector: Growth Trend, Inflation, Labor Market, Consumer Health, Rate Pressure, and Credit Stress. Selector buttons switch the visible main Economy category, and each metric cell is clickable/tappable in a single-row six-card desktop layout with horizontal overflow on smaller screens to control the larger chart for the selected category. Economy charts preserve FRED original units rather than converting between millions, billions, and trillions; metric tiles show the metric label, latest value with a smaller muted unit beside it, QoQ change, and YoY change; chart titles append the selected FRED series ID; chart details show spaced range, frequency, and seasonal adjustment metadata without `Unit` or `Source: FRED`; chart x-axis titles are removed while x-axis ticks show years only and tooltips retain date/`Q1 2022`-style period labels; Economy-specific info icons are removed, no separate Economy metric View More page is used, each selected category shows a concise blue-accent summary bar above the metric cards, signal tags sit beside metric titles, selected metric detail cards for What it is, What it measures, and Why investors care stay visible to the left of the chart; and reusable y-axis domain/layout logic uses natural 1/2/5/10-style intervals, roughly 5–10 ticks, minimal decimals, honest padded line-chart domains based on the selected visible data, plus a vertically centered y-axis label with moderate left margin/axis width to prevent overlap with large, compact, negative, index, and percentage tick values. The server-side `fetchFredSeries` helper calls the FRED observations endpoint with `FRED_API_KEY`, normalizes numeric observations, drops `.` missing values, and the Economy payload is cached through `dashboard_snapshots` as `economy:latest`. FRED observations are stored in `fred_economy`; `refresh-economy` wakes hourly (`0 * * * *`) with a Toronto runtime guard that runs FRED provider work once every 24 hours at 12:00 PM America/Toronto, incrementally fetching observations after each series latest saved date while empty/new series still backfill the configured 30-year history window. The Sentiment tab removes the top Indicators / Market Expectations button row and restores a 3-card summary row above the sentiment/positioning panel.

The Flow page now lays out Flow Summary, Insider Trades, Dark Pool, and Whale Feed as separate card rows. Flow Summary is derived through shared helper logic so refresh snapshots and server loaders can include Insider sentiment, `Largest Dark Pool Print (14D)`, and Whale Feed fields without duplicating calculations in components. The dark-pool summary title reflects the 14-day prune/retention window, and clickable summary cards use the Markets heatmap-style hover lift.

Dark Pool ticker drilldowns use `/flow/dark-pool/[ticker]` as the primary detail route. The server-side loader queries Supabase/source rows by ticker and sorts ticker detail rows by `executed_at` descending, falling back to fixtures only when cached rows are unavailable. Browser components still do not call Unusual Whales and never receive the Supabase service role key.

### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` on weekdays; a Toronto runtime guard runs provider work every hour Monday-Friday and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are upserted into `unusual_whales_whale_feed` without replacing recent history, pruned only when `executed_at` is older than 14 days, and normalized with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page supports client-side View more in batches of 10 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (14D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 14 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (14D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.

### Status job telemetry boundary

Status no longer depends on Netlify function-log APIs or Netlify auth tokens. Scheduled functions write start/end rows to Supabase `job_runs` through `lib/status/job-runs.ts`, including status, row counts, warnings, errors, and safe metadata. The `/status` page and `/api/cache/status` are dynamic/no-store, read `job_runs` server-side, expose only safe operational fields plus a Supabase read-health diagnostic, and the Status page auto-refreshes every 5 minutes while open so current telemetry is visible without redeploy. Component status labels render as Good/Healthy, Warning/Stale or delayed, Critical/Action required, and Offline/No status available. Netlify logs remain useful for manual debugging in the Netlify UI/CLI, but they are not a dashboard data source. Future automated jobs must be added to `lib/status/jobs.ts` and instrumented with job telemetry. Rows older than 24 hours are pruned server-side from `job_runs` during telemetry writes via the tracked Supabase retention helper.

Status display names include `Institutional Holdings` for the `refresh-institutional-portfolios` job. Status schedule notes: Market Overview / `refresh-market-quotes` runs every 5m from the start of Sunday through the end of Friday in Toronto/Eastern time (`*/5 * * * *` with a Toronto weekday guard); Put/Call Ratio / `refresh-put-call` runs every 30m Monday-Friday (`*/30 * * * 1-5`); Top News / `refresh-featured-articles` and Unusual Whales News Feed / `refresh-news-feed` run every 30m daily (`*/30 * * * *`); Today’s Economic Events / `refresh-economic-events` and Today’s Earnings / `fetch-uw-earnings` run every 6h daily (`0 */6 * * *`); Indices/Heatmaps / `refresh-markets` runs every 5m Monday-Friday (`*/5 * * * 1-5`); Insider Trades, Dark Pool, and Whale Feed run hourly Monday-Friday (`0 * * * 1-5`); `refresh-flow` wakes hourly at :05 (`5 * * * *`) and its Toronto weekday guard allows Monday-Friday provider work; Economy Data / `refresh-economy` wakes hourly (`0 * * * *`) but its Toronto guard runs FRED provider work once every 24 hours at 12:00 PM America/Toronto; source labels stay short and safe; and the Status note says `All times are shown in Eastern Standard Time.` Netlify may show platform-generated wording for cron expressions, so docs record both the actual cron and intended human-readable schedule.

Dark Pool expanded view initially shows 15 rows and reveals 30 additional rows per View more click, matching Whale Feed pagination while preserving Dark Pool-specific data logic. Institutional Holdings list tables display full `name`, while institution detail compact titles display `short_name` with a fallback to full `name`. Detail `% of Portfolio` uses cached `perc_of_share_value * 100` as a neutral unsigned percentage. Compare-to-SPY return popups render in a foreground portal layer to avoid clipping by table/card containers. Option holdings persist `put_oi` and `call_oi` from the nested Unusual Whales `oi` object, including JSON-string `oi` payloads, so `% of OI` uses `units / put_oi` for puts and `units / call_oi` for calls. Activity ingestion logs safe per-institution fetch, normalize, upsert, and skip counts. The Institution Detail Stock Holdings UI hides zero-unit positions and displays current position Value as `units * close` from cached holdings data, showing `—` when `close` is unavailable instead of falling back to stale report-date pricing. The Institution Detail Activity UI shows row-level activity records without aggregating duplicate tickers, excludes `Warrant` rows case-insensitively, capitalizes activity labels, colors positive activity green and negative activity red, labels the price movement column `Δ Price Since Activity`, shows signed `Change in Value` as `units_change * price_on_report` immediately after Change in Units, and sorts by largest row-level displayed value (`units * close`) with missing values last. Activity ingestion now keeps only each institution's latest available `report_date` quarter, logs latest-quarter keep/skip counts, and the Supabase cleanup migration `0024_tracked_activity_latest_quarter_cleanup.sql` removes older-quarter and Warrant activity rows from `unusual_whales_tracked_institution_activity`.

`fetch-uw-earnings.ts` calculates the active earnings window as previous-week Monday through next-week Friday in America/Toronto, fetches that provider range server-side, and prunes `unusual_whales_earnings_events.report_date` rows outside that window during each refresh. The cache also continues to exclude `market_cap_size = micro`, and refresh logs/telemetry include safe fetched, persisted, skipped-micro, and outside-window prune counts. The News & Calendar Earnings Calendar card omits the old optional-persistence helper copy.
