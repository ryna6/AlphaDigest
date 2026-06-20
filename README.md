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

### Sources, Methodology, and Settings

Utility pages list intended source coverage and environment variable names. Secret values are never shown in the browser. The desktop sidebar and mobile primary-tab bar remain available while scrolling.

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
- Some dashboard areas are intentionally fixture-backed today, especially Whale Trades, Ownership, Economy & Sentiment, and ticker detail data.
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

Flow and Ownership are now separate primary tabs. Flow contains Flow Summary, Dark Pool, Whale Trades, and Insider Trades. Ownership contains Institutional/13F positioning and Congressional Trades. Dark pool and insider trades are fetched server-side from Unusual Whales by Netlify scheduled functions and cached in Supabase; browser components never call Unusual Whales directly and never receive `SUPABASE_SERVICE_ROLE_KEY`.

Dark pool uses the large-print Unusual Whales filter endpoint once daily and retains up to 7 days of rows in `unusual_whales_dark_pool_flows`; the current plan is expected to return roughly two-day delayed data. Insider trades use the provided corporate-insider endpoint once daily, store only normalized transaction fields in `unusual_whales_insider_trades`, and UI/API reads filter to the past 3 months. The Flow insider card shows the top 5 companies, `/flow/insider-trades` shows the top 25, and `/flow/insider-trades/[ticker]` shows individual transactions. Whale Trades, Institutional/13F, and Congressional Trades remain fixture-backed placeholders until live endpoints/providers are added.

Apply `supabase/manual/apply-unusual-whales-flow.sql` in the Supabase SQL Editor before running `refresh-dark-pool`, `refresh-insider-trades`, `refresh-flow`, or `refresh-ownership` in Netlify. `/api/cache/status` reports the new source tables and `flow:latest` / `ownership:latest` snapshots.
