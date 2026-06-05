# Unusual Whales earnings calendar

MarketRecap now works automatically without requiring you to set up Supabase first.

The app reads earnings from server-side code only using the unauthenticated Unusual Whales PHX endpoint:

`https://phx.unusualwhales.com/api/companies_earnings/upcoming_earnings_v2`

Default query params are `formats=table`, `order=oi`, and `order_direction=desc`. Dynamic `min_date` and `max_date` default to a rolling window of today minus 3 days through today plus 14 days.

## Automatic behavior, no manual hosting required

1. The `News & Calendar` page asks the MarketRecap server for earnings.
2. If Supabase is configured, MarketRecap reads/writes the Supabase cache.
3. If Supabase is not configured, MarketRecap automatically fetches the Unusual Whales endpoint server-side and keeps a short in-memory cache so the browser never calls Unusual Whales directly.
4. If the live server fetch fails, MarketRecap falls back to `public/data/unusual-whales/earnings-calendar.json`.

This means the dashboard still works on Netlify without you manually hosting a database.

## Optional Supabase persistence

Supabase is optional. If you want durable cached history and change-detection across deployments/function instances, set these in Netlify:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the service role key to browser code. The dashboard reads cached earnings from server/API code.

Apply `supabase/migrations/0002_unusual_whales_earnings.sql` if using Supabase. It creates:

- `unusual_whales_earnings_events`
- `data_refresh_metadata`

The row id is stable: `uw-earnings:{symbol}:{report_date}:{report_time}`.

## Refreshing data

Manual local/server refresh if you want to debug or write the fallback file:

```bash
npm run fetch:uw-earnings -- --min_date 2026-06-01 --max_date 2026-06-06 --write-fallback
```

Netlify functions:

- `/.netlify/functions/fetch-uw-earnings` refreshes the optional durable cache and is configured with `* * * * *` so Netlify can run it every minute where scheduled functions are available for the site/plan.
- `/.netlify/functions/get-uw-earnings` returns a small frontend-safe cached JSON payload with filters (`min_date`, `max_date`, `symbol`, `sp500_only`, `has_options`, `limit`, `order`).

If a deployed Netlify setup or plan does not run one-minute schedules reliably, no manual hosting is required for the UI to work because the page has automatic server-side live fallback. You can still trigger the refresh function from GitHub Actions cron, cron-job.org, EasyCron, Upstash QStash, Supabase cron/pg_cron, or another scheduler if you later want durable persistence.

## UI format

The main `News & Calendar` tab intentionally uses the same compact structure as the previous earnings snapshot: ticker, company, report timing, EPS estimate, actual placeholders, revenue placeholders, and market cap. The expanded internal view adds the extra Unusual Whales fields such as date, expected move, OI, and call/put volume.

## Change detection

When Supabase is configured, the refresh job normalizes rows, sorts them deterministically, hashes the normalized payload, compares that hash to `data_refresh_metadata`, and skips row upserts when the payload is unchanged. When data changes, it upserts only rows whose row-level `content_hash` differs.
