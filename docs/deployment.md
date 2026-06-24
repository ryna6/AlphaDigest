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
- Declared schedule: every 6 hours daily (`0 */6 * * *`) where Netlify supports scheduled functions for the site/plan.
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

- `refresh-put-call.ts` wakes every 30 minutes on the hour and half-hour Monday through Friday (`*/30 * * * 1-5`).
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

The `/status` page displays the operational Status table with Job, Status, Source, Schedule, Last Run, and Next Run columns. Source values are short safe provider names rather than raw endpoints, statuses are centered in their column, and Status page times are calculated with America/Toronto while the page note reads “All times are shown in Eastern Standard Time.” Several Netlify schedules use broad UTC cron wakes plus `lib/schedule/toronto.ts` runtime guards so provider fetches occur in the intended Eastern/Toronto windows without hard-coded EST offsets. Current guarded schedules include market quotes every 5 minutes from the start of Sunday through the end of Friday in Toronto/Eastern time, markets every 5 minutes Monday-Friday, economic events and earnings every 6 hours daily, hourly Flow source jobs Monday-Friday, and `refresh-flow` hourly at :05 with a Monday-Friday Toronto guard for sequencing. A future full-site sequencing overhaul may further refine these dependencies.

## Deploying Flow cache tables

Netlify deploys do not automatically apply Supabase migrations. Before enabling Flow refresh jobs, paste `supabase/manual/apply-unusual-whales-flow.sql` into the Supabase SQL Editor. Then deploy to Netlify and manually run `refresh-dark-pool`, `refresh-insider-trades`, `refresh-flow`, and optionally `refresh-ownership`. Check Supabase row counts, `dashboard_snapshots` keys `flow:latest` and `ownership:latest`, `/api/cache/status`, `/flow`, `/ownership`, `/flow/insider-trades`, and a sample insider detail page.

### Verifying Flow refreshes in production

After deploying Flow ingestion changes, manually run the Netlify functions in this order: `refresh-dark-pool`, `refresh-whale-feed`, `refresh-insider-trades`, and `refresh-flow`. Dark-pool logs should show HTTP status, content type, response shape/path, `rawCount`, normalized count, skipped count/reasons, upserted count, pruned count, and `emptyReason` if the provider returns no rows. Insider logs should show pages 0 through 3 (up to 2,000 rows), per-page HTTP status/raw/normalized/6-month filtered counts, duplicates removed, upserted count, content hash, lookback months = 6, any partial refresh warning, and no `ON CONFLICT` duplicate-key batch error. Then open `/api/cache/status` and verify Flow table counts, latest metadata errors, dark-pool `emptyReason`, dark-pool retention/window days, insider duplicate-removal counts, lookback months, latest page counts, Flow insider rows used, aggregate company counts, and `flow:latest` snapshot presence/freshness. Check Supabase row counts for `unusual_whales_dark_pool_flows`, `unusual_whales_insider_trades`, and `dashboard_snapshots` where `key = 'flow:latest'`.


### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` on weekdays; a Toronto runtime guard runs provider work every hour Monday-Friday and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page supports client-side View more in batches of 10 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (7D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 7 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (14D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.

### Supabase job telemetry for Status

The `/status` page and `/api/cache/status` use Supabase `job_runs` as the source of truth for job status and Last Run. Each scheduled function should call `startJobRun` when provider work begins and `finishJobRun` or `recordJobRun` when it succeeds, warns, errors, or intentionally skips a guarded wake-up. `job_runs` records function/job names, source, start/end timestamps, status, row counts, warnings, errors, and safe JSON metadata. The Status page and Status API are dynamic/no-store, query telemetry at request time, and the Status page auto-refreshes every 5 minutes while open so browser refreshes and polling can show current telemetry without redeploy. Component status labels render as Good/Healthy, Warning/Delayed or missing, Critical/Action required, and Offline/No status available. Netlify logs are only for manual debugging in the Netlify UI/CLI and are not fetched by the dashboard. After deploying this change, old Netlify log-diagnostic environment variables are not required for Status and may be removed if they were only used for log diagnostics. Future scheduled jobs must be added to the central Status registry and instrumented with job telemetry. `job_runs` rows older than 24 hours are pruned server-side during telemetry writes via the tracked Supabase retention helper.

The Status table column formerly labeled `Endpoint` is now `Source`. Source values are intentionally short provider names such as `Yahoo`, `Cboe`, `Unusual Whales`, `Investing.com`, and `Supabase`; raw URLs, API paths, query strings, API keys, and secret-bearing values must not be displayed. The component status legend is centered within its card with widened horizontal spacing while the jobs table keeps Job left-aligned and Status centered. Put/Call Ratio displays `Every 30m, Mon–Fri`; Flow source jobs display hourly Monday-Friday, with `refresh-flow` running hourly at :05 Monday-Friday.


Status schedule notes: Market Overview / `refresh-market-quotes` runs every 5m from the start of Sunday through the end of Friday in Toronto/Eastern time (`*/5 * * * *` with a Toronto weekday guard); Put/Call Ratio / `refresh-put-call` runs every 30m Monday-Friday (`*/30 * * * 1-5`); Top News / `refresh-featured-articles` and Unusual Whales News Feed / `refresh-news-feed` run every 30m daily (`*/30 * * * *`); Today’s Economic Events / `refresh-economic-events` and Today’s Earnings / `fetch-uw-earnings` run every 6h daily (`0 */6 * * *`); Indices/Heatmaps / `refresh-markets` runs every 5m Monday-Friday (`*/5 * * * 1-5`); Insider Trades, Dark Pool, and Whale Feed run hourly Monday-Friday (`0 * * * 1-5`); `refresh-flow` wakes hourly at :05 (`5 * * * *`) and its Toronto weekday guard allows Monday-Friday provider work; source labels stay short and safe; and the Status note says `All times are shown in Eastern Standard Time.` Netlify may show platform-generated wording for cron expressions, so docs record both the actual cron and intended human-readable schedule.

### Job run retention RPC

`public.cleanup_old_job_runs()` is tracked as a no-argument Supabase RPC for server-side scheduled-function telemetry. It deletes `job_runs` rows whose `started_at` is older than 24 hours and grants execution to the service role only. Deploy the Supabase migration before relying on scheduled jobs to call the RPC; if PostgREST still reports the old schema cache immediately after deployment, refresh/reload the Supabase schema cache before rechecking Netlify logs.
