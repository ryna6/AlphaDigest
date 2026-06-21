# Data sources and data pipelines

This document records active and placeholder data sources. Accuracy matters: do not describe a source as live unless the current code fetches it and the relevant page/API uses it.

## Source status summary

| Source/provider                                                                     | Active use today                                                                                        | Files                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Finnhub quote API                                                                   | Active for market metrics, heatmaps, and optional company logos when keys exist.                        | `lib/data/live-dashboard.ts`, `lib/data/adapters/finnhub-key-router.ts`       |
| Yahoo Finance public chart/quote endpoints                                          | Active for selected quotes such as `^VIX`, `^VIX3M`, and `ES=F`; has optional Supabase refresh helpers. | `lib/data/adapters/yahoo-finance.ts`                                          |
| Unusual Whales featured news page/Next data                                         | Active for Today featured articles and Top News pages.                                                  | `lib/data/adapters/unusual-whales-news.ts`, `lib/data/live-dashboard.ts`      |
| Unusual Whales headline feed PHX endpoint                                           | Active for News & Calendar latest market news.                                                          | `lib/data/adapters/unusual-whales-news.ts`, `lib/data/live-dashboard.ts`      |
| Unusual Whales earnings PHX endpoint                                                | Active for Today and News & Calendar earnings, with Supabase/live/static fallback flow.                 | `lib/data/adapters/unusual-whales-earnings.ts`                                |
| Investing.com economic calendar endpoint                                            | Active for Today and News & Calendar economic events.                                                   | `lib/data/adapters/investing-economic-calendar.ts`                            |
| Cboe U.S. Options Market Statistics                                                 | Active server-side parser for intraday equity, index, and total put/call ratios.                        | `lib/data/adapters/cboe-put-call.ts`, `netlify/functions/refresh-put-call.ts` |
| Supabase                                                                            | Optional durable cache for supported refresh helpers, including put/call observations.                  | `lib/db/supabase.ts`, `supabase/`                                             |
| Static earnings fallback JSON                                                       | Active fallback when Supabase/live earnings paths are unavailable.                                      | `public/data/unusual-whales/earnings-calendar.json`                           |
| FRED, Twelve Data, CoinGecko, sec-api.io, Capitol Trades, CBOE, AAII, HormuzTracker | Listed/planned or placeholder only unless future code wires them into live flows.                       | Methodology/Status pages and fixtures currently reference some of these names.   |

## Environment variables

Current names referenced by app pages and APIs:

```text
NEXT_PUBLIC_APP_NAME
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FINNHUB_GLOBAL_MARKETS_API_KEY
FINNHUB_SECTORS_HEATMAP_API_KEY
FINNHUB_CRYPTO_HEATMAP_API_KEY
FINNHUB_MACRO_HEATMAP_API_KEY
TWELVE_DATA_API_KEY
COINGECKO_API_KEY
FRED_API_KEY
SEC_API_KEY
SCRAPER_ENABLED
HORMUZ_TRACKER_ENABLED
```

Only `NEXT_PUBLIC_APP_NAME` is intended to be client-safe. Provider keys and Supabase service role credentials are server-only.

`/api/sources/status` reports boolean configured/missing values for environment variables and Finnhub feature areas. It never returns secret values.

## Finnhub quote and heatmap flow

Files:

- `lib/data/adapters/finnhub-key-router.ts`
- `lib/data/live-dashboard.ts`
- `lib/constants/asset-icons.ts`
- `public/assets/heatmap-icons/`

Feature-area key mapping:

| Feature area      | Env var                              |
| ----------------- | ------------------------------------ |
| `global-markets`  | `FINNHUB_GLOBAL_MARKETS_API_KEY`     |
| `sectors-heatmap` | `FINNHUB_SECTORS_HEATMAP_API_KEY`    |
| `crypto-heatmap`  | CoinGecko no-key server-side adapter |
| `macro-heatmap`   | `FINNHUB_MACRO_HEATMAP_API_KEY`      |

Live quote behavior:

1. `getFinnhubKey(featureArea)` checks for the correct key.
2. `fetchFinnhubQuote(featureArea, symbol)` calls `https://finnhub.io/api/v1/quote` with `cache: "no-store"`.
3. Missing keys, non-OK responses, and invalid prices return `null` rather than throwing.
4. Callers merge live values with fixture fallback data.

Current quote groups:

- Global: SPY, EWC, IEUR, EWJ, EWT, EWH, EWY, INDA.
- Sectors: XLK, XLF, XLC, XLY, XLI, XLV, XLP, XLU, XLB, XLE, XLRE, SMH.
- Crypto: BTCUSD, ETHUSD, SOLUSD, XRPUSD, BNBUSD, TRXUSD, ADAUSD, DOGEUSD are fetched through CoinGecko as USD quotes with true 24-hour percentage changes. Today Market Overview and the Markets crypto heatmap consume the same normalized server-side dataset with a 60-second in-memory TTL.
- Macro: GLD, SLV, USO, UNG, SHY, TLT, HYG, UUP.

Company logo behavior:

- `fetchFinnhubCompanyLogo()` uses the global-markets Finnhub key and `/stock/profile2`.
- Logo requests use `next: { revalidate: 86400 }` and an in-memory promise cache.
- Today fallback earnings can be enriched with these logos.

## Yahoo Finance flow

Files:

- `lib/data/adapters/yahoo-finance.ts`
- `lib/data/live-dashboard.ts`

Current direct use:

- `fetchYahooMarketQuote("^VIX")` can populate VIX in Today key stats.
- `fetchYahooMarketQuote("ES=F")` can populate S&P 500 Futures in Markets.

Adapter behavior:

- Tries Yahoo chart endpoints first, then quote fallback endpoints.
- Uses short request timeouts and retry rules for transient statuses.
- Includes optional Supabase refresh/cache helpers for `^VIX` and `ES=F`, but the main live dashboard currently calls direct fetch helpers.

## Unusual Whales featured news flow

Files:

- `lib/data/adapters/unusual-whales-news.ts`
- `lib/data/live-dashboard.ts`
- `components/dashboard/today/today-view.tsx`

Current flow:

1. `fetchUnusualWhalesFeaturedNews(50)` discovers the Unusual Whales Next.js build id from `https://unusualwhales.com/news`.
2. It fetches Next data payloads for featured news and article detail payloads when available.
3. It normalizes article slug, title, timestamps, tags, image, excerpt, content text/html, source URL, raw payload, and fetched timestamp.
4. Today uses returned items when available; otherwise it falls back to `todayMock.featuredNews`.

Important separation:

- Featured news feeds Today and Top News pages.
- Headline feed data feeds News & Calendar.
- Do not merge these without an explicit product decision.

Optional Supabase helper functions exist in the adapter (`refreshUnusualWhalesFeaturedArticles()` and `getCachedUnusualWhalesFeaturedArticles()`), but the current Today page directly fetches live featured news rather than reading Supabase cache.

## Unusual Whales headline feed flow

Files:

- `lib/data/adapters/unusual-whales-news.ts`
- `lib/data/live-dashboard.ts`
- `components/dashboard/news-calendar/news-calendar-view.tsx`

Current endpoint:

```text
https://phx.unusualwhales.com/api/news/headlines-feed?limit=100&major_only=true
```

Current flow:

1. `fetchUnusualWhalesNewsFeed(100)` fetches JSON from the endpoint.
2. Records are normalized into `NewsItem` values.
3. News & Calendar displays the first 12 items on the main page.
4. `/news-calendar/news` displays up to 100 with client-side “More”.
5. If no items are returned, `getNewsCalendarPayload()` builds fallback news from Today featured articles.

Optional Supabase helper functions exist (`refreshUnusualWhalesNewsFeed()` and `getCachedUnusualWhalesNewsFeed()`), but the current News & Calendar page directly fetches live headline feed data.

## Unusual Whales earnings flow

Files:

- `lib/data/adapters/unusual-whales-earnings.ts`
- `lib/data/earnings-utils.ts`
- `lib/data/live-dashboard.ts`
- `netlify/functions/fetch-uw-earnings.ts`
- `netlify/functions/get-uw-earnings.ts`
- `scripts/fetchUnusualWhalesEarnings.ts`
- `public/data/unusual-whales/earnings-calendar.json`
- `supabase/migrations/0002_unusual_whales_earnings.sql`
- `supabase/migrations/0003_uw_earnings_implied_move_pct.sql`

Current endpoint:

```text
https://phx.unusualwhales.com/api/companies_earnings/upcoming_earnings_v2
```

Default query params include:

- `formats=table`
- `order=oi`
- `order_direction=desc`
- dynamic `min_date` and `max_date`
- `min_marketcap=4000000000`
- `country_codes[]=US`

Default range:

- `defaultEarningsRange()` uses today minus 3 UTC days through today plus 14 UTC days.
- News & Calendar uses a broader selectable range based on its economic-calendar week: week start minus 7 days through week end plus 7 days.

Caching/fallback order in `getCachedUnusualWhalesEarnings()`:

1. Use a short in-memory live server cache if the key matches and has not expired.
2. If Supabase credentials are missing, attempt a live server fetch.
3. If live fetch succeeds, return `mode: "live"` and cache for 60 seconds.
4. If live fetch fails without Supabase, load `public/data/unusual-whales/earnings-calendar.json` when possible.
5. If Supabase is configured, read filtered rows from `unusual_whales_earnings_events` and metadata from `data_refresh_metadata`.
6. If Supabase read fails, fall back to static JSON.
7. If no path succeeds, return `mode: "unavailable"` with a message.

Normalization details:

- Stable event id: `uw-earnings:{SYMBOL}:{reportDate}:{reportTime || unknown}`.
- Rows are deduped by id and sorted deterministically.
- Implied move percentage is calculated from implied/expected move divided by current/previous price when possible.
- Content hashes exclude fetch timestamps so unchanged data can skip unnecessary upserts.

Display rules:

- Today filters major earnings for current ET date and shows a compact top-five panel.
- News & Calendar filters by selected weekday and groups into Before Open and After Close. Regular/unknown sessions are displayed under After Close.
- `getMajorEarningsForDate()` applies source-level filters such as U.S., minimum market cap, and market-cap sorting.

Manual refresh script:

```bash
npm run fetch:uw-earnings -- --min_date 2026-06-01 --max_date 2026-06-06 --write-fallback
```

Netlify functions:

- `/.netlify/functions/fetch-uw-earnings` refreshes Supabase when configured and is declared with `schedule: "* * * * *"`.
- `/.netlify/functions/get-uw-earnings` exposes a serverless getter with `min_date`, `max_date`, `symbol`, `sp500_only`, `has_options`, `limit`, and `order` filters.

## Investing.com economic calendar flow

Files:

- `lib/data/adapters/investing-economic-calendar.ts`
- `lib/data/config/included-economic-events.ts`
- `lib/data/economic-surprise.ts`
- `lib/data/live-dashboard.ts`
- `components/dashboard/news-calendar/news-calendar-view.tsx`
- `scripts/validateNewsCalendarUi.tsx`

Current behavior:

1. `buildInvestingEconomicCalendarWeekRange(dateKey)` calculates a Monday-Friday range for the requested date.
2. `fetchInvestingEconomicCalendar(dateKey)` fetches the provider endpoint for that week.
3. Events are normalized into stable event ids, event date, timestamp/time, actual, forecast, previous, country, star importance, and highlight metadata.
4. Highlighting is based on included economic-event configuration and star importance.
5. Exclusion patterns remove low-signal or duplicate rows, including exports/imports details, without excluding broader Trade Balance events.
6. Today filters events to the current ET date.
7. News & Calendar preloads adjacent weeks and fetches selected days on demand.

Optional Supabase helpers:

- `refreshInvestingEconomicEvents()` refreshes date keys and upserts `investing_economic_events`.
- `getCachedInvestingEconomicCalendar()` reads one cached date.

The current dashboard fetches the live Investing.com endpoint directly through the server-side adapter rather than requiring Supabase.

## Static fixtures and mock mode

Fixture data lives in `lib/data/fixtures/mock-dashboard.ts` and currently backs:

- Flow reads Supabase cached dark pool, whale feed, and insider tables, then section-level fixtures; Ownership remains fixture-backed for Institutional/13F and Congressional sections.
- Economy & Sentiment page and API.
- Ticker Explorer detail page and API.
- Fallback market/today/news/earnings values when live data is unavailable.

When replacing fixture-backed sections with live data:

1. Add/adjust adapter code first.
2. Add schemas or update existing schemas.
3. Wire page-level data functions and API routes.
4. Keep fallback behavior explicit.
5. Update README and relevant docs in the same change.

## Supabase schema and migrations

Key files:

- `supabase/schema.sql`
- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_unusual_whales_earnings.sql`
- `supabase/migrations/0003_uw_earnings_implied_move_pct.sql`

Important tables used by current adapter helpers include:

- `data_refresh_metadata`
- `unusual_whales_earnings_events`
- `unusual_whales_news_feed`
- `unusual_whales_featured_articles`
- `investing_economic_events`
- `market_quotes`

Some tables in the schema are forward-looking and are not wired to current UI flows. Do not assume a table is actively used simply because it exists.

## Rate-limit and fallback risks

- Finnhub quote calls can be numerous because each heatmap tile is an individual quote request.
- Unusual Whales and Investing.com public endpoints can change shape or block/limit requests.
- Yahoo Finance public endpoints are not a contractual API.
- Netlify scheduled function frequency and availability depend on site plan/settings.
- In-memory caches do not survive deployments or cold starts.
- Static fallback JSON can become stale; only update it intentionally through the earnings script.

## Cboe Total put/call ratio

`lib/data/adapters/cboe-put-call.ts` fetches Cboe U.S. Options Market Statistics server-side and parses the intraday Exchange Market Statistics table for `Equity Options`, `Index Options`, and `Total Options` put/call ratios. It treats the parsed source timestamp as `America/Chicago` first, records `sourceTimezone`, `displayTimezone`, `sourceAsOfCentral`, `asOfEastern`, and `scrapedAt`, then stores those fields when Supabase is configured. The upsert key is `external_id`, derived from the normalized Eastern release instant, so repeated scheduled runs do not create duplicates. Failed parsing logs a server-side error and does not overwrite the most recent valid Supabase record.

`netlify/functions/refresh-put-call.ts` uses the existing Netlify scheduled-function architecture. The cron expression is `0,30 * * * *`, and the function applies an `America/Chicago` runtime gate for the source schedule: 9:00 AM, 9:30 AM, continuing every 30 minutes through 3:30 PM Central, Monday through Friday. AlphaDigest displays the equivalent Eastern schedule as 10:00 AM through 4:30 PM ET. The broad UTC wake-up schedule lets the IANA timezone gate account for DST without hard-coded UTC offsets.

## Risk On / Risk Off

The Today card uses Yahoo Finance `^VIX` from the existing VIX flow and Yahoo Finance `^VIX3M` for the 3-month volatility index. The displayed ratio is exactly `VIX3M / VIX`, rounded to two decimals, and is shown only when both Yahoo source values are finite positive current index levels.

## Crypto quote cache and failure behavior

`lib/data/adapters/coingecko-crypto.ts` centralizes supported crypto quotes through CoinGecko `simple/price` in USD with `include_24hr_change=true`. The server cache TTL is 60 seconds. Provider failures return an unavailable result and empty quote set rather than mock prices; the Markets crypto heatmap therefore does not silently display stale bundled fallback crypto values when live crypto quotes fail.

## Dashboard snapshot cache

The active tab APIs now prefer Supabase `dashboard_snapshots` before provider-specific live fetches. The snapshot layer is intentionally separate from normalized source tables:

| Snapshot key           | Producer                               | Consumer                                            | Fallback                                                                            |
| ---------------------- | -------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `today:latest`         | `netlify/functions/refresh-today.ts`   | `getTodayPayload()` and `/api/today`                | Existing live Today builder, then mock/static fallbacks already present in adapters |
| `markets:latest`       | `netlify/functions/refresh-markets.ts` | `getMarketsPayload()` and `/api/markets`            | Existing market quote/crypto/live builder, then mock market fixture                 |
| `news-calendar:latest` | `netlify/functions/refresh-news.ts`    | `getNewsCalendarPayload()` and `/api/news-calendar` | Existing UW news, UW earnings, Investing calendar, and fixture fallback behavior    |

Source-specific cache status remains mixed: Unusual Whales earnings and Cboe put/call are active Supabase-backed flows; Unusual Whales news/articles, Yahoo quotes, and Investing economic events have adapter-level Supabase helpers but are only dashboard-fast after the scheduled snapshot job writes the combined payload. Generic `refresh-flow`, `refresh-economy`, `refresh-ticker`, and `refresh-sources-status` remain placeholders until implemented.

## Source table refresh corrections

The production failure mode was metadata drift: `data_refresh_metadata` could report a successful fetch while the corresponding source table was empty. Source refresh helpers now upsert non-empty fetched rows on each successful refresh and report `ok: false` when Supabase persistence is unavailable or fails. Apply `0006_source_cache_tables.sql` so the deployed schema includes `unusual_whales_news_feed`, `unusual_whales_featured_articles.created_at_source`, `investing_economic_events`, and `market_quotes`.

Active source refresh functions:

| Function                    | Table                              | Schedule                                             |
| --------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `fetch-uw-earnings`         | `unusual_whales_earnings_events`   | `* * * * *`                                          |
| `refresh-news-feed`         | `unusual_whales_news_feed`         | `10,40 * * * *`                                      |
| `refresh-featured-articles` | `unusual_whales_featured_articles` | `20,50 * * * *`                                      |
| `refresh-economic-events`   | `investing_economic_events`        | `5 11,15,21 * * 1-5`                                 |
| `refresh-market-quotes`     | `market_quotes`                    | `*/15 14-22 * * 1-5`                                 |
| `refresh-put-call`          | `put_call_observations`            | `0,30 * * * *` plus runtime Cboe market-window gate |

## Cache schema expectation map

| Table                              | Writers                                                                          | Upsert conflict | Required notable columns                                                                                               | Production action                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `data_refresh_metadata`            | refresh adapters and dashboard snapshot writer                                   | `source`        | `source`, `ok`, `fetched_at`, `changed`, `row_count`, `content_hash`, `error`, `meta`                                  | created by existing migrations; status endpoint reports latest errors.                    |
| `investing_economic_events`        | `refreshInvestingEconomicEvents()` / `refresh-economic-events` / `refresh-today` | `id`            | includes `source_url`, `event_time`, `content_hash`, `fetched_at`, `updated_at`                                        | `0007_fix_cache_schema_mismatches.sql` and manual SQL repair missing `source_url`.        |
| `market_quotes`                    | Yahoo market quote refresh and `refresh-markets`                                 | `id`            | quote fields plus `source`, `symbol`, `market_time`, `content_hash`                                                    | existing source cache table; used before `markets:latest` snapshot.                       |
| `unusual_whales_earnings_events`   | earnings refresh                                                                 | `id`            | earnings fields plus `content_hash`, `fetched_at`, `updated_at`                                                        | existing migrations.                                                                      |
| `unusual_whales_featured_articles` | featured/news/today refreshes                                                    | `id`            | includes `created_at_source`, `published_at`, `source_url`, `content_hash`                                             | `0007_fix_cache_schema_mismatches.sql` and manual SQL repair missing `created_at_source`. |
| `unusual_whales_news_feed`         | news feed/news refreshes                                                         | `id`            | includes `event_time`, `source_url`, `content_hash`                                                                    | `0007_fix_cache_schema_mismatches.sql` and manual SQL repair missing `event_time`.        |
| `put_call_observations`            | Cboe put/call adapter and `refresh-put-call`                                     | `external_id`   | `ratio_type`, `value`, `equity_ratio`, `index_ratio`, `total_ratio`, `market_date`, `as_of_eastern`, source timestamps | `0007_fix_cache_schema_mismatches.sql` and manual SQL create the table if missing.        |
| `dashboard_snapshots`              | `refreshDashboardSnapshot()` / dashboard refresh functions                       | `key`           | `key`, `payload`, `mode`, `notices`, `generated_at`, `expires_at`, `source_hash`, `metadata`                           | manual SQL creates/repairs and reloads schema cache.                                      |

`refresh-news` is scheduled once in code (`*/30 * * * *`) and no duplicate schedule exists in `netlify.toml`; rapid repeated production runs are therefore most consistent with manual repeated execution unless Netlify itself retried failed invocations.

## Unusual Whales Flow sources

- Dark pool: `https://phx.unusualwhales.com/api/flow/dark-pool?...` exactly as configured in `lib/data/adapters/unusual-whales-dark-pool.ts`; fetched server-side once daily by `refresh-dark-pool`, saved to `unusual_whales_dark_pool_flows`, and pruned after 7 days. Stored provider fields are only `executed_at`, `ticker`, `sector`, `price`, `premium`, `size`, `volume`, and `avg30_volume` plus minimal metadata.
- Insider trades: `https://phx.unusualwhales.com/api/insider_trades/feed?...` exactly as configured in `lib/data/adapters/unusual-whales-insider-trades.ts`; fetched server-side once daily by `refresh-insider-trades` across pages 0 through 3 (up to 2,000 rows), filtered to the past 6 months, with purchase amounts positive and sale amounts negative. Stored provider fields are only ticker, sector, amount, transaction date, price, owner/title, transaction code, and shares owned after plus minimal metadata.
- Whale Feed is now cached in `unusual_whales_whale_feed`; Institutional/13F and Congressional remain fixture-backed in Ownership.

### Flow ingestion diagnostics

Unusual Whales Flow data is fetched only from Netlify server-side functions and cached in Supabase. The dark-pool refresh uses the filtered `phx.unusualwhales.com/api/flow/dark-pool` endpoint and stores only `executed_at`, `ticker`, `sector`, `price`, `premium`, `size`, `volume`, `avg30_volume`, and internal cache metadata in `unusual_whales_dark_pool_flows`; rows older than 7 days are pruned. A zero-row dark-pool refresh can be legitimate when the provider is delayed, the subscription/plan has no matching rows, filters are too restrictive, or the endpoint shape changes, including the observed `{ trades: [...] }` response wrapper. Refresh metadata and logs now include HTTP status, content type, top-level response keys, detected row path, raw/normalized/skipped/upserted/pruned counts, and `emptyReason` when no rows are stored.

Insider trades are fetched from the provided server-side Unusual Whales insider feed across up to four pages, filtered to the past 6 months by `transaction_date`, normalized so purchases are positive and sales are negative, assigned stable deterministic `external_id` values, deduped by `external_id`, and then upserted into `unusual_whales_insider_trades`. Duplicate-removal counts and a small duplicate ID sample are written to refresh metadata so Supabase `ON CONFLICT` failures can be diagnosed without exposing provider payloads.

### Flow display and aggregation semantics

Flow source ingestion remains server-side through Netlify functions and Supabase. Browser/client components do not call Unusual Whales directly. Dark-pool rows are stored with UTC `executed_at` timestamps in `unusual_whales_dark_pool_flows`, but dashboard tables display `executed_at` in Eastern Time (`ET`) using `America/Toronto` formatting.

Insider trade rows in `unusual_whales_insider_trades` are aggregated with the shared `aggregateInsiderTrades()` helper. The helper filters to the past 6 months, groups by ticker, counts total trades/purchases/sales, preserves sector when available, sums signed net shares and signed net value, and sorts by trade count descending with absolute net value as a tie-breaker. Weighted average trade price is calculated as `sum(abs(shares) * price) / sum(abs(shares))`, excluding rows with missing/non-finite price or zero shares. `/flow` displays the top 5 companies from this aggregate; `/flow/insider-trades` initially displays the top 25 and can reveal up to the top 50 with View more. Individual insider detail rows include `shares_owned_after` from Supabase, but aggregate company views intentionally omit it.

### Flow snapshot fallback priority

`/flow` treats a fresh `flow:latest` snapshot with `mode = mock` as a fixture snapshot, not as authoritative real data. It also bypasses older Flow snapshots that do not include 6-month insider diagnostics. When that happens, the page rebuilds the Flow payload from Supabase source tables before falling back to fixtures. Fresh non-mock snapshots remain the first choice only when they report the 6-month Supabase-backed insider row population; fixture/mock rows are used only when the relevant source data is missing, empty, or unavailable.

### Flow Summary and Dark Pool display details

Flow Summary derives `Largest Dark Pool Print (7D)` and Insider sentiment from the same Supabase-backed Flow source rows used by the Dark Pool and Insider Trades cards whenever real rows are available; fixture fallback is retained only when live/cache rows are unavailable. The dark-pool label is 7D because the adapter prunes rows older than 7 days. The Flow Summary cards link to valid Flow destinations and use the Markets heatmap-style hover lift. Insider Sentiment is calculated as `purchaseValue / (purchaseValue + saleValue)`, with purchase value from positive purchase shares times price and sale value from the absolute value of sale shares times price. Ratios `> 0.505` display as Bullish, ratios `< 0.495` display as Bearish, and the small documented band around 0.5 displays as Neutral.

Dark Pool source rows remain stored as UTC/timestamptz where applicable in `unusual_whales_dark_pool_flows`. The Flow UI formats dark-pool `executed_at` values only for display in Eastern Time as `MM/DD HH:mm` without an `ET` suffix.

Unusual Whales calls for Flow remain server-side in Netlify functions/adapters; Supabase stores normalized/cache rows only, and browser components consume cached payloads rather than provider APIs or service-role credentials.


### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` hourly on weekdays; a Toronto runtime guard runs provider work every 2 hours from 4 AM through 8 PM and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page initially shows 15 server-loaded rows and supports client-side View more in batches of 15 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (7D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 7 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (7D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.
