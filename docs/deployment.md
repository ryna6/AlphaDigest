# Deployment

AlphaDigest is configured for Netlify deployment with Next.js App Router support.

## Netlify configuration

`netlify.toml` defines:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[build.environment]
  NEXT_TELEMETRY_DISABLED = "1"
```

The Netlify Next.js plugin adapts App Router pages and API routes for Netlify. Serverless functions live in `netlify/functions/`.

## Deploy from GitHub

1. Push the repository to GitHub.
2. Create a Netlify site from Git.
3. Set build command to `npm run build`.
4. Set publish directory to `.next`.
5. Ensure the Netlify Next.js plugin is installed/resolved during build.
6. Add environment variables in Netlify site settings.
7. Deploy.
8. Verify the app routes and key API routes.

Suggested smoke-test paths after deploy:

- `/overview/today`
- `/markets`
- `/news-calendar`
- `/api/today`
- `/api/markets`
- `/api/news-calendar`
- `/api/sources/status`
- `/.netlify/functions/get-uw-earnings`

## Production environment variables

Configure values in Netlify site settings. Do not commit real secrets.

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

Current required-vs-optional reality:

- The app can render without Supabase or provider keys by using fixture/fallback data.
- Finnhub keys are required for live quote-driven market heatmaps and several market metrics.
- Supabase URL and service role key are required for durable cache reads/writes in supported refresh helpers.
- The Unusual Whales earnings live fallback does not require a provider key.
- Some listed keys are planned/placeholder for future integrations and are not currently consumed by active dashboard flows.

## Supabase deployment notes

Supabase is optional but recommended if durable caches are needed.

Apply migrations from `supabase/migrations/` in order when enabling Supabase-backed cache flows:

1. `0001_initial_schema.sql`
2. `0002_unusual_whales_earnings.sql`
3. `0003_uw_earnings_implied_move_pct.sql`

Current adapter helpers can use these tables:

- `data_refresh_metadata`
- `unusual_whales_earnings_events`
- `unusual_whales_news_feed`
- `unusual_whales_featured_articles`
- `investing_economic_events`
- `market_quotes`

Because not every Supabase table is wired to current UI flows, verify actual adapter usage before relying on a table in deployment docs or runbooks.

## Netlify functions

### Active earnings functions

`fetch-uw-earnings.ts`:

- URL: `/.netlify/functions/fetch-uw-earnings`
- Declared schedule: every minute (`* * * * *`) where Netlify supports scheduled functions for the site/plan.
- Accepts optional `min_date` and `max_date` query params.
- Calls `refreshUnusualWhalesEarnings()`.
- Writes to Supabase only when Supabase server credentials are configured.

`get-uw-earnings.ts`:

- URL: `/.netlify/functions/get-uw-earnings`
- Accepts `min_date`, `max_date`, `symbol`, `sp500_only`, `has_options`, `order`, and `limit`.
- Returns frontend-safe earnings data through `getCachedUnusualWhalesEarnings()`.

### Placeholder functions

These currently return placeholder JSON and should not be described as production ingestion jobs:

- `refresh-today.ts`
- `refresh-news.ts`
- `refresh-markets.ts`
- `refresh-flow.ts`
- `refresh-economy.ts`
- `refresh-ticker.ts`
- `refresh-sources-status.ts`

If any placeholder becomes real, update `docs/architecture.md`, `docs/data-sources.md`, this deployment file, and README if user-visible freshness behavior changes.

## Build and validation commands

Run before deploying when possible:

```bash
npm run typecheck
npm run lint
npm run build
npm run validate:news-calendar
```

Current caveat: `npm run lint` uses `next lint`; if the installed Next.js version no longer supports that command, update the lint script rather than ignoring lint indefinitely.

## Data freshness and operational caveats

- Netlify scheduled functions are not guaranteed to run every minute on all plans/configurations.
- In-memory server caches reset on cold starts and deployments.
- Public endpoints can rate-limit or change shape without notice.
- Static fallback JSON can become stale if not refreshed intentionally.
- Missing Finnhub keys reduce Markets and Today live coverage.
- `/api/sources/status` confirms only whether variables are set; it does not validate provider credentials with live test calls.

## Deployment change checklist

When changing deployment behavior:

1. Update `netlify.toml` and any function code together.
2. Update environment variable lists in README, `docs/development.md`, `docs/data-sources.md`, and this file.
3. Update smoke-test instructions if route/function names change.
4. Document any new scheduler, cron, queue, or Supabase requirement.
5. Run `npm run build` at minimum.
