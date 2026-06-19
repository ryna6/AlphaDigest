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

### Flow & Ownership

A currently fixture-backed view for big-money activity concepts:

- Dark pool prints.
- Whale option trades.
- Insider trades.
- Congressional trades.
- Institutional 13F positioning.

### Economy & Sentiment

A currently fixture-backed macro dashboard for rates, inflation, labor, sentiment, oil/geopolitical risk, and liquidity conditions.

### Ticker Explorer

A placeholder ticker-intelligence area. The explorer page does not perform live lookup yet; direct ticker detail routes are fixture-backed until a live ticker pipeline is added.

### Sources, Methodology, and Settings

Utility pages list intended source coverage and environment variable names. Secret values are never shown in the browser. The desktop sidebar and mobile primary-tab bar remain available while scrolling.

## Data sources at a glance

AlphaDigest keeps third-party calls server-side where possible. Current active sources include:

- **Finnhub** for quote-driven market metrics and heatmaps when the relevant API keys are configured.
- **Yahoo Finance public endpoints** for selected quote metrics such as VIX and S&P 500 futures.
- **Finnhub quote API** for `INDEXCBOE:VIX3M`, used with Yahoo Finance VIX to compute `VIX3M / VIX`.
- **Cboe U.S. Options Market Statistics** for the intraday Total put/call ratio, parsed server-side and optionally persisted to Supabase.
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
- Some dashboard areas are intentionally fixture-backed today, especially Flow & Ownership, Economy & Sentiment, and ticker detail data.
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
