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

| Route                             | Purpose                                                | Main component/data source                                   |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `/`                               | Redirects to Today.                                    | `app/page.tsx` redirects to `/overview/today`.               |
| `/overview/today`                 | Daily briefing.                                        | `getTodayPayload()` and `TodayView`.                         |
| `/overview/today/top-news`        | Paginated featured article list.                       | `getTodayPayload()` and `TopNewsListClient`.                 |
| `/overview/today/top-news/[slug]` | Featured article detail.                               | Today featured article payload.                              |
| `/markets`                        | Market strip and heatmaps.                             | `getMarketsPayload()` and `MarketsView`.                     |
| `/news-calendar`                  | Latest news, economic calendar, and earnings calendar. | `getNewsCalendarPayload()` and `NewsCalendarView`.           |
| `/news-calendar/news`             | Expanded latest-news list.                             | `AllNewsView`.                                               |
| `/news-calendar/earnings`         | Expanded earnings calendar.                            | `AllEarningsView`.                                           |
| `/flow-ownership`                 | Flow/ownership dashboard.                              | `flowMock` fixture.                                          |
| `/economy-sentiment`              | Economy/sentiment dashboard.                           | `economyMock` fixture.                                       |
| `/ticker-explorer`                | Symbol lookup entry page.                              | `TickerExplorerView`.                                        |
| `/ticker/[symbol]`                | Ticker detail page.                                    | `TickerDetailView`, currently fixture-backed.                |
| `/sources-methodology`            | Source reference table.                                | Static page-level source list.                               |
| `/settings`                       | Environment variable name/status helper.               | Static variable list, points users to `/api/sources/status`. |

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
| `/api/flow-ownership`                         | Returns `flowMock`.                                                                     |
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
2. Fetches VIX from the existing Yahoo Finance VIX flow and VIX3M from Finnhub `INDEXCBOE:VIX3M`, then computes `VIX3M / VIX` only when both positive index levels are available.
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
