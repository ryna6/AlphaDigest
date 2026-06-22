# AlphaDigest

AlphaDigest is a dark-mode market intelligence dashboard for quickly answering:

- What is moving today?
- Which headlines, earnings, and economic events matter?
- Where is cross-asset performance strongest or weakest?
- Which areas need a deeper look before the next market session?

The app combines live server-side market/news/calendar fetches with clearly labeled fallback data when an external source or API key is unavailable.

## What you can view

### Today

A daily briefing page with:

- Major market stats such as S&P 500, Nasdaq 100, WTI oil, gold, Bitcoin from live CoinGecko USD quotes, and VIX.
- A compact market summary for leading sectors, risk tone, earnings count, and economic-event count.
- Featured Unusual Whales articles with a separate Top News page.
- Today's major earnings and economic events.
- A sector snapshot based on the same market heatmap data used by the Markets tab.

### Markets

Cross-asset heatmaps and a market strip for:

- Global markets.
- U.S. sectors and semiconductors.
- Major crypto pairs from a shared server-side CoinGecko quote adapter used by Today and Markets.
- Macro assets such as gold, silver, oil, natural gas, bonds, credit, and the dollar.

### News & Calendar

A combined events workspace with:

- Latest market headlines.
- A weekday selector for last week, this week, and next week.
- Economic calendar events with actual/forecast/previous values, highlighted high-importance releases, and exports/imports detail rows filtered out while Trade Balance remains visible.
- Earnings grouped into before-open and after-close sessions.
- Separate “View All” pages for market news and earnings.

### Flow

A Supabase-first view for big-money flow concepts:

- Flow Summary.
- Dark pool prints from server-side Unusual Whales refreshes.
- Whale option trades, currently fixture-backed until a live endpoint is added.
- Insider trades from server-side Unusual Whales refreshes, aggregated by company.

### Ownership

A currently fixture-backed ownership view for Institutional/13F positioning and Congressional trades until live providers are added.

### Economy & Sentiment

A currently fixture-backed macro dashboard for rates, inflation, labor, sentiment, oil/geopolitical risk, and liquidity conditions.

### Ticker Explorer

A placeholder ticker-intelligence area. The explorer page does not perform live lookup yet; direct ticker detail routes are fixture-backed until a live ticker pipeline is added.

### Methodology and Status

Methodology lists intended source coverage and environment variable names. The Status tab is a server-rendered job monitoring page grouped by dashboard tab. It keeps the table columns to Job, Status, Source, Frequency, Last Run, and Next Run; the Job cell shows both the user-facing component name and the actual Netlify function/job name, the Source cell shows short safe provider names, not raw endpoints, and the Status cell is center-aligned. Status rows read fresh Supabase `job_runs` telemetry for Last Run and health, calculate the next run from the central status job registry schedules, display times under the note “All times are shown in Eastern Standard Time.” without repeating timezone suffixes in each cell, and keep planned TBD jobs Unknown rather than Healthy. The Status page/API use dynamic no-store behavior, the page auto-refreshes every 5 minutes while open, and browser refreshes should fetch current telemetry without redeploy. Future automated jobs should be added to `lib/status/jobs.ts` and instrumented with `lib/status/job-runs.ts`; schedules that need Eastern/Toronto precision should use the shared Toronto runtime guard rather than fixed UTC offsets. Secret values are never shown in the browser. The desktop sidebar and mobile primary-tab bar remain available while scrolling.

## Data sources at a glance

AlphaDigest keeps third-party calls server-side where possible. Current active sources include:

- **Finnhub** for quote-driven market metrics and heatmaps when the relevant API keys are configured.
- **Yahoo Finance public endpoints** for selected quote metrics such as `^VIX`, `^VIX3M`, and S&P 500 futures.
- **Cboe U.S. Options Market Statistics** for intraday equity, index, and total put/call ratios, parsed server-side and optionally persisted to Supabase.
- **Unusual Whales public endpoints/pages** for featured news, headline feed, and earnings calendar data.
- **Investing.com economic calendar endpoint** for economic events.
- **Supabase** as an optional durable cache for supported ingestion flows.
- **Static fallback JSON** for the Unusual Whales earnings calendar when live/server cache paths fail. Market quotes and put/call values do not use synthetic fallback prices.

Some tabs still use mock/fixture data while provider integrations are built out. The UI and API responses label fallback/mock mode where applicable.

## Run locally

Requirements:

- Node.js 20 or newer.
- npm.

```bash
npm install
npm run dev
```

Then open the local Next.js URL shown in your terminal, usually `http://localhost:3000`.

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run validate:news-calendar
```

## Environment variables

For the best local or deployed experience, configure only the keys you actually use:

```text
NEXT_PUBLIC_APP_NAME=AlphaDigest

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

FINNHUB_GLOBAL_MARKETS_API_KEY=
FINNHUB_SECTORS_HEATMAP_API_KEY=
FINNHUB_CRYPTO_HEATMAP_API_KEY=
FINNHUB_MACRO_HEATMAP_API_KEY=

TWELVE_DATA_API_KEY=
COINGECKO_API_KEY=
FRED_API_KEY=
SEC_API_KEY=

SCRAPER_ENABLED=
HORMUZ_TRACKER_ENABLED=false
```

Server-only keys must not be exposed with a `NEXT_PUBLIC_` prefix.

## Deployment

The project is configured for Netlify with:

- Build command: `npm run build`.
- Publish directory: `.next`.
- Netlify Next.js plugin.
- Serverless functions in `netlify/functions/`.

Production environment variables should be configured in Netlify site settings. Supabase is optional for the app to render, but it enables durable caches for supported refresh jobs.

## Caveats

- Live providers can fail because of rate limits, upstream shape changes, network errors, or missing API keys.
- Unusual Whales and Investing.com integrations depend on public endpoint/page shapes and may need maintenance if those providers change their responses.
- Some dashboard areas are intentionally fixture-backed today, especially Whale Feed, Ownership, Economy & Sentiment, and ticker detail data.
- Data freshness depends on provider availability, request timing, optional Supabase cache state, and Netlify scheduled-function support.

## Technical documentation

Developer and Codex-focused documentation lives in [`docs/`](docs/):

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/features.md`](docs/features.md)
- [`docs/data-sources.md`](docs/data-sources.md)
- [`docs/development.md`](docs/development.md)
- [`docs/deployment.md`](docs/deployment.md)
- [`docs/codex-guidelines.md`](docs/codex-guidelines.md)

Documentation maintenance is required: when behavior, data flow, UI, scripts, APIs, deployment, environment variables, or architecture change, update the relevant docs in the same change.

## Supabase-first dashboard cache

AlphaDigest remains a serverless web deployment: GitHub stores code, Netlify hosts the Next.js frontend and scheduled/serverless functions, and Supabase Cloud hosts Postgres. The active dashboard tabs now prefer frontend-ready Supabase `dashboard_snapshots` rows before live provider calls:

- `today:latest` for Today.
- `markets:latest` for Markets.
- `news-calendar:latest` for News & Calendar.

Netlify scheduled functions refresh those snapshots ahead of user navigation. If Supabase is not configured or a snapshot is missing/stale, the existing live provider and fixture/static fallback paths still render the app.

### Cache repair and verification

Apply all Supabase migrations through `0006_source_cache_tables.sql` before relying on scheduled refreshes. The source refresh functions now upsert rows for news feed, featured articles, economic events, market quotes, earnings, and put/call data; dashboard refresh functions write `today:latest`, `markets:latest`, and `news-calendar:latest`. Use `/api/cache/status` after deploy to confirm row counts, latest metadata errors, missing snapshot keys, and snapshot freshness.

### Production Supabase cache schema repair

Netlify deploys do not automatically apply Supabase SQL migrations unless a separate migration pipeline is configured. If scheduled refresh logs show PostgREST schema-cache errors such as missing `investing_economic_events.source_url`, `unusual_whales_featured_articles.created_at_source`, `unusual_whales_news_feed.event_time`, `put_call_observations`, or `dashboard_snapshots`, run `supabase/manual/apply-cache-schema-fix.sql` in the Supabase SQL Editor. The SQL is idempotent, reloads the PostgREST schema cache with `notify pgrst, 'reload schema'`, and aligns production with the Netlify refresh adapters.

After applying it, manually run `refresh-economic-events`, `refresh-featured-articles`, `refresh-news-feed`, `refresh-news`, `refresh-today`, `refresh-put-call`, and `refresh-markets` in Netlify. Then open `/api/cache/status` to confirm row counts, expected columns, current metadata, and snapshot keys `today:latest`, `markets:latest`, and `news-calendar:latest`.

### Flow and Ownership split

Flow and Ownership are now separate primary tabs. Flow contains a three-card Flow Summary, plus full-width Insider Trades, Dark Pool, and Whale Feed rows. Ownership contains Institutional/13F positioning and Congressional Trades. Dark pool and insider trades are fetched server-side from Unusual Whales by Netlify scheduled functions and cached in Supabase; browser components never call Unusual Whales directly and never receive `SUPABASE_SERVICE_ROLE_KEY`.

Dark pool uses the large-print Unusual Whales filter endpoint once daily and retains up to 7 days of rows in `unusual_whales_dark_pool_flows`; the current plan is expected to return roughly two-day delayed data. Insider trades use up to four server-side pages (up to 2,000 rows) from the provided corporate-insider endpoint once daily, store only normalized transaction fields in `unusual_whales_insider_trades`, and UI/API reads filter to the past 6 months. Dark Pool displays execution time as `MM/DD HH:mm` in Eastern Time and ticker detail pages show all available same-ticker prints sorted by most recent execution time first. Flow Summary replaces Top insider activity with Insider sentiment, calculated as `purchaseValue / (purchaseValue + saleValue)` and labeled Bullish, Bearish, or Neutral. The Flow insider card and Insider sentiment both use the same full Supabase-backed 6-month insider row population as `/flow/insider-trades`; the main card slices the shared aggregate to the top 5, while `/flow/insider-trades` initially shows the top 25 and can reveal up to the top 50 with View more, and `/flow/insider-trades/[ticker]` shows individual transactions. Whale Feed is Supabase-backed from its server-side refresh table when rows exist. Institutional/13F and Congressional Trades remain under Ownership fixture fallback until live endpoints/providers are added.

Apply `supabase/manual/apply-unusual-whales-flow.sql` in the Supabase SQL Editor before running `refresh-dark-pool`, `refresh-whale-feed`, `refresh-insider-trades`, `refresh-flow`, or `refresh-ownership` in Netlify. `/api/cache/status` reports the new source tables and `flow:latest` / `ownership:latest` snapshots.

Flow refresh diagnostics now distinguish provider/fetch success from data persistence success. `refresh-dark-pool` logs safe Unusual Whales response-shape diagnostics, including the observed `{ trades: [...] }` dark-pool shape and records `emptyReason` when zero rows are returned or all rows are skipped; dark-pool cache rows are retained for 7 days. `refresh-insider-trades` filters to the past 6 months, applies purchase/sale signs deterministically, creates stable upsert IDs, dedupes rows before Supabase upsert, and records duplicate-removal counts. `refresh-flow` may persist a partial `flow:latest` snapshot when one source succeeds, but logs source statuses and notices clearly. Use `/api/cache/status` after deployment to verify Flow row counts, metadata errors, dark-pool empty reasons, insider duplicate counts, `flow:latest` freshness, the 6-month insider rows used by Flow, insider aggregate counts, and the 7-day dark-pool retention/window.

### Flow UI updates

The Flow tab includes View All pages for Dark Pool, Whale Feed, and Insider Trades. Insider Trades on `/flow` shows the top 5 real Supabase-backed company aggregates when cached rows exist; `/flow/insider-trades` initially shows the top 25 and can reveal up to the top 50 with View more using the same aggregation helper and sort order. The weighted average trade price is calculated by shares as `sum(abs(shares) * price) / sum(abs(shares))`. Individual insider ticker pages include `shares_owned_after` in the far-right detail column. Flow timestamps are displayed in Eastern Time (`ET`) while Supabase timestamp storage remains UTC/timestamptz.

Flow card navigation and fallback behavior were tightened so expanded-page Back controls sit in card header action areas, date-only insider transaction fields omit `ET`, and `/flow` rebuilds from Supabase source tables instead of trusting a fresh mock or stale pre-diagnostics `flow:latest` snapshot when real cached rows may exist. Flow Summary mini cards are clickable where a destination exists and use the same hover-lift cursor treatment as Markets heatmap tiles; the dark-pool summary title reflects the current 7-day retention as `Largest Dark Pool Print (7D)` and displays ticker left with premium beside it.


### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` on weekdays; a Toronto runtime guard runs provider work every 2 hours from 4 AM through 8 PM and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page initially shows 15 server-loaded rows and supports client-side View more in batches of 15 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (7D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 7 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (7D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.


Status schedule notes: Unusual Whales News Feed / `refresh-news-feed` runs every 30m every day (`*/30 * * * *`); Today’s Earnings / `fetch-uw-earnings` runs every 4h from midnight (`0 */4 * * *`); Today’s Economic Events / `refresh-economic-events` runs every 6h from midnight (`0 */6 * * *`); Put/Call Ratio / `refresh-put-call` runs every 30m Monday-Friday (`*/30 * * * 1-5`); Flow jobs remain every 2h, with `refresh-flow` offset by 5 minutes; Market Overview source label in Status is `Finnhub`; and the Status note says `All times are shown in Eastern Standard Time.`
