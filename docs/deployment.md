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

Apply migrations from `supabase/migrations/` in order when enabling Supabase-backed cache flows, including `0004_cboe_put_call_intraday.sql` for intraday put/call storage:

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

- `refresh-put-call.ts` is scheduled with `5,35 14-21 * * 1-5` UTC and a runtime `America/Chicago` source-time gate so Cboe Total put/call refreshes occur only from 9:05 AM through 3:35 PM Central on weekdays, displayed as 10:05 AM through 4:35 PM ET across DST.
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

## Supabase-first dashboard cache deployment

Required Netlify environment variables for durable dashboard snapshots:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose as `NEXT_PUBLIC_`)
- Provider keys/cookies already required by the live adapters, such as Finnhub and Unusual Whales credentials where applicable.

Apply Supabase migrations in order, including `0005_dashboard_snapshots_cache.sql`. The app can still render without Supabase, but `/api/today`, `/api/markets`, and `/api/news-calendar` will use live fallback paths instead of the fast durable snapshot path.

Scheduled functions:

- `refresh-markets`: `*/10 14-22 * * 1-5` UTC.
- `refresh-today`: `*/15 12-23 * * 1-5` UTC.
- `refresh-news`: `*/30 * * * *` UTC.
- Existing `fetch-uw-earnings` and `refresh-put-call` remain source-specific refresh jobs.

Smoke tests after deploy:

1. Visit `/api/sources/status` to confirm server env detection.
2. Visit `/api/cache/status` to inspect non-secret Supabase configuration, snapshot freshness, table counts, and metadata.
3. Trigger the refresh functions manually or wait for schedules.
4. Confirm `dashboard_snapshots` has `today:latest`, `markets:latest`, and `news-calendar:latest` rows.
5. Confirm the tab APIs respond quickly and report cached mode while snapshots are fresh.

### Manual refresh function URLs

After applying migrations, trigger these Netlify functions from the deployed site when validating Supabase cache health:

- `/.netlify/functions/fetch-uw-earnings`
- `/.netlify/functions/refresh-news-feed`
- `/.netlify/functions/refresh-featured-articles`
- `/.netlify/functions/refresh-economic-events`
- `/.netlify/functions/refresh-market-quotes`
- `/.netlify/functions/refresh-today`
- `/.netlify/functions/refresh-markets`
- `/.netlify/functions/refresh-news`

Then check `/api/cache/status`. Expected healthy output includes non-zero row counts for active source tables, current `data_refresh_metadata.fetched_at` timestamps, and non-missing snapshot keys `today:latest`, `markets:latest`, and `news-calendar:latest`.

## Manual Supabase cache schema repair

GitHub/Netlify deployments only deploy application code; they do not apply Supabase migrations unless a migration pipeline has been explicitly added. For immediate production repair, paste `supabase/manual/apply-cache-schema-fix.sql` into the Supabase SQL Editor. It is safe to re-run, creates or repairs the durable cache tables used by Netlify functions, and sends `notify pgrst, 'reload schema'` so PostgREST sees new columns.

After the SQL succeeds, run these Netlify functions manually: `refresh-economic-events`, `refresh-featured-articles`, `refresh-news-feed`, `refresh-news`, `refresh-today`, `refresh-put-call`, and `refresh-markets`. Healthy logs should show source `rowsUpserted > 0` for non-empty provider responses, `snapshotPersisted: true` for dashboard refreshes, and `ok: true` without missing table/column errors. Supabase should then contain rows in `investing_economic_events`, `unusual_whales_featured_articles`, `unusual_whales_news_feed`, `put_call_observations`, and `dashboard_snapshots` rows for `today:latest`, `markets:latest`, and `news-calendar:latest`.

Use `/api/cache/status` for non-secret diagnostics: configured Supabase status, expected/missing tables and columns, row counts, latest metadata errors, snapshot timestamps, freshness, payload sizes, and missing expected snapshot keys.

## Deploying Flow cache tables

Netlify deploys do not automatically apply Supabase migrations. Before enabling Flow refresh jobs, paste `supabase/manual/apply-unusual-whales-flow.sql` into the Supabase SQL Editor. Then deploy to Netlify and manually run `refresh-dark-pool`, `refresh-insider-trades`, `refresh-flow`, and optionally `refresh-ownership`. Check Supabase row counts, `dashboard_snapshots` keys `flow:latest` and `ownership:latest`, `/api/cache/status`, `/flow`, `/ownership`, `/flow/insider-trades`, and a sample insider detail page.

### Verifying Flow refreshes in production

After deploying Flow ingestion changes, manually run the Netlify functions in this order: `refresh-dark-pool`, `refresh-insider-trades`, and `refresh-flow`. Dark-pool logs should show HTTP status, content type, response shape/path, `rawCount`, normalized count, skipped count/reasons, upserted count, pruned count, and `emptyReason` if the provider returns no rows. Insider logs should show pages 0 through 3 (up to 2,000 rows), per-page HTTP status/raw/normalized/6-month filtered counts, duplicates removed, upserted count, content hash, lookback months = 6, any partial refresh warning, and no `ON CONFLICT` duplicate-key batch error. Then open `/api/cache/status` and verify Flow table counts, latest metadata errors, dark-pool `emptyReason`, dark-pool retention/window days, insider duplicate-removal counts, lookback months, latest page counts, Flow insider rows used, aggregate company counts, and `flow:latest` snapshot presence/freshness. Check Supabase row counts for `unusual_whales_dark_pool_flows`, `unusual_whales_insider_trades`, and `dashboard_snapshots` where `key = 'flow:latest'`.
