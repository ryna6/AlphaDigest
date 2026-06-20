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

| Route                             | Purpose                                                | Main component/data source                                                 |
| --------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `/`                               | Redirects to Today.                                    | `app/page.tsx` redirects to `/overview/today`.                             |
| `/overview/today`                 | Daily briefing.                                        | `getTodayPayload()` and `TodayView`.                                       |
| `/overview/today/top-news`        | Paginated featured article list.                       | `getTodayPayload()` and `TopNewsListClient`.                               |
| `/overview/today/top-news/[slug]` | Featured article detail.                               | Today featured article payload.                                            |
| `/markets`                        | Market strip and heatmaps.                             | `getMarketsPayload()` and `MarketsView`.                                   |
| `/news-calendar`                  | Latest news, economic calendar, and earnings calendar. | `getNewsCalendarPayload()` and `NewsCalendarView`.                         |
| `/news-calendar/news`             | Expanded latest-news list.                             | `AllNewsView`.                                                             |
| `/news-calendar/earnings`         | Expanded earnings calendar.                            | `AllEarningsView`.                                                         |
| `/flow`                           | Flow dashboard.                                        | `getFlowPayload()` reads `flow:latest`, Flow source tables, then fixtures. |
| `/ownership`                      | Ownership dashboard.                                   | `ownershipMock` fixture / optional `ownership:latest`.                     |
| `/flow-ownership`                 | Legacy redirect.                                       | Redirects to `/flow`.                                                      |
| `/economy-sentiment`              | Economy/sentiment dashboard.                           | `economyMock` fixture.                                                     |
| `/ticker-explorer`                | Symbol lookup entry page.                              | `TickerExplorerView`.                                                      |
| `/ticker/[symbol]`                | Ticker detail page.                                    | `TickerDetailView`, currently fixture-backed.                              |
| `/sources-methodology`            | Source reference table.                                | Static page-level source list.                                             |
| `/settings`                       | Environment variable name/status helper.               | Static variable list, points users to `/api/sources/status`.               |

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
| `/api/flow/insider-trades`                    | Returns top 25 cached insider company aggregates.                                       |
| `/api/flow/insider-trades/[ticker]`           | Returns cached insider detail rows for one ticker.                                      |
| `/api/flow-ownership`                         | Legacy redirect to `/api/flow`.                                                         |
| `/api/economy-sentiment`                      | Returns `economyMock`.                                                                  |
| `/api/ticker/[symbol]`                        | Returns `tickerMock(symbol)`.                                                           |
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

- `fetch-uw-earnings.ts`: scheduled every minute where Netlify scheduled functions are supported; refreshes optional Supabase earnings cache.
- `get-uw-earnings.ts`: frontend-safe serverless getter for filtered cached/live/fallback earnings.

Placeholder functions:

- `refresh-today.ts`
- `refresh-news.ts`
- `refresh-markets.ts`
- `refresh-flow.ts`
- `refresh-economy.ts`
- `refresh-ticker.ts`
- `refresh-sources-status.ts`

The placeholder functions only return JSON that describes future ingestion flow. Do not document them as active refresh pipelines until they are implemented.

## Static assets and fallback files

- Heatmap and metric icon images are stored in `public/assets/heatmap-icons/`.
- Icon resolution is centralized in `lib/constants/asset-icons.ts`; do not hard-code icon paths in components.
- `public/data/unusual-whales/earnings-calendar.json` is the static fallback for earnings calendar data.

## Styling system

- Global styles and font import live in `app/globals.css`.
- Tailwind custom colors and `Space Grotesk` font configuration live in `tailwind.config.ts`.
- Core visual primitives are intentionally square/compact: `Panel`, `MetricRow`, `DataTable`, `Heatmap`, `SectionHeader`, `InfoTooltip`, `ErrorState`, and `EmptyState`.
- Large layouts generally use responsive grids with `xl:` breakpoints and mobile-first stacking.
- The desktop sidebar is sticky at the viewport top, and below `lg` a sticky mobile header exposes the primary tabs in a horizontally scrollable tab bar.

## Known architecture limitations

- Several pages remain fixture-backed even though source/methodology pages list future intended providers.
- `refresh-put-call.ts`: scheduled at `5,35 14-21 * * 1-5` UTC and gated against the source schedule in `America/Chicago` so the Cboe scraper runs only from 9:05 AM through 3:35 PM Central on weekdays, which displays as 10:05 AM through 4:35 PM ET. The wide UTC window covers Eastern standard and daylight time; the runtime gate prevents off-window duplicate work.
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
- `refresh-featured-articles` writes `unusual_whales_featured_articles`, including the required `created_at_source` column.
- `refresh-economic-events` writes `investing_economic_events`.
- `refresh-market-quotes` writes `market_quotes`.
- `refresh-today`, `refresh-markets`, and `refresh-news` also write `dashboard_snapshots` keys used by the active tabs.

Source refresh helpers upsert fetched rows even when content hashes match existing metadata. This prevents a false-success state where metadata says rows were fetched but production tables are empty after a migration, truncate, or failed earlier write.

## Supabase durable cache contract

The production architecture remains serverless: GitHub stores code, Netlify hosts the Next.js frontend and scheduled/serverless functions, and Supabase Cloud hosts Postgres. Netlify functions fetch providers and upsert normalized source rows, then dashboard refresh jobs write frontend-ready `dashboard_snapshots`. The browser never receives `SUPABASE_SERVICE_ROLE_KEY`; server code and Netlify functions perform privileged cache writes.

The current cache contract is captured by migrations through `0007_fix_cache_schema_mismatches.sql` and the pasteable production repair file `supabase/manual/apply-cache-schema-fix.sql`. Active write flows include `data_refresh_metadata`, `investing_economic_events`, `market_quotes`, `unusual_whales_earnings_events`, `unusual_whales_featured_articles`, `unusual_whales_news_feed`, `put_call_observations`, and `dashboard_snapshots`. `/api/today`, `/api/markets`, and `/api/news-calendar` read fresh snapshots first, fall back to live server-side providers when needed, and may return stale snapshots only if live fallback fails.

## Flow/Ownership cache architecture

The former `/flow-ownership` product area is split into `/flow` and `/ownership`; `/flow-ownership` redirects safely to `/flow`. Netlify scheduled functions fetch the provided Unusual Whales dark-pool and insider endpoints server-side, upsert normalized rows into Supabase Cloud, and write `flow:latest` dashboard snapshots. No browser/client component calls Unusual Whales or receives `SUPABASE_SERVICE_ROLE_KEY`.

Flow reads `flow:latest` first, then source tables `unusual_whales_dark_pool_flows` and `unusual_whales_insider_trades`, then fixtures. Ownership may read `ownership:latest`, but its Institutional/13F and Congressional sections remain fixture-backed because no live endpoints were provided. This preserves the GitHub + Netlify + Supabase serverless architecture with no self-hosted services, Docker, production Node server, or always-on backend.

### Flow refresh integrity

Flow ingestion preserves the GitHub + Netlify + Supabase Cloud architecture: Netlify functions fetch Unusual Whales server-side, upsert only normalized fields into Supabase, and frontend/page APIs read `flow:latest` or source tables before fixture fallback. The dark-pool adapter now detects common response shapes (`$`, `data`, `trades`, `results`, `rows`, `items`, `data.rows`, `data.items`, `data.results`, `data.trades`) and records safe diagnostics without logging secrets or full raw payloads. Insider rows are assigned deterministic IDs from provider IDs when available, otherwise from canonical transaction fields, then deduped before `onConflict: "external_id"` upserts. Partial Flow snapshots are allowed only with explicit source status and notices.

### Flow routes and timestamp display

Flow now has expanded section routes for `/flow/dark-pool`, `/flow/whale-trades`, and `/flow/insider-trades`, plus ticker drilldowns for insider trades and dark-pool prints. These pages continue to read through server-side dashboard loaders/API paths backed by Supabase snapshots/source tables and fixture fallback. Dark Pool and Insider Trades data remain server-side cached; Whale Trades remains fixture-backed until a live endpoint is provided.

Dashboard-facing Flow date/time rendering uses explicit Eastern Time (`America/New_York`) helpers and labels values as `ET`. This is a presentation-layer choice only; Supabase timestamp columns continue to store UTC/timestamptz values, and Netlify/platform logs can remain UTC.

### Flow mock snapshot bypass

The Flow dashboard keeps snapshot-first behavior for real cached payloads, but it no longer lets a fresh mock `flow:latest` snapshot mask real Supabase source rows. If the snapshot mode is `mock`, `getFlowPayload()` rebuilds from `unusual_whales_dark_pool_flows` and `unusual_whales_insider_trades` and persists a replacement snapshot only when the rebuilt payload is live. This preserves fallback behavior without allowing fixture rows to override real cache data.

### Flow route and summary behavior

The Flow page now lays out Flow Summary, Dark Pool, Whale Trades, and Insider Trades as separate card rows. Flow Summary is derived through shared helper logic so refresh snapshots and server loaders can include Dark Pool Signal, Whale Feed Signal, and Insider sentiment fields without duplicating calculations in components.

Dark Pool ticker drilldowns use `/flow/dark-pool/[ticker]` as the primary detail route. The server-side loader queries Supabase/source rows by ticker and sorts ticker detail rows by `executed_at` descending, falling back to fixtures only when cached rows are unavailable. Browser components still do not call Unusual Whales and never receive the Supabase service role key.
