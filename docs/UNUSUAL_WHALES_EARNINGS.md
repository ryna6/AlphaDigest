# Unusual Whales earnings cache

MarketRecap ingests the unauthenticated Unusual Whales PHX earnings endpoint from server-side code only:

`https://phx.unusualwhales.com/api/companies_earnings/upcoming_earnings_v2`

Default query params are `formats=table`, `order=oi`, and `order_direction=desc`. The dynamic `min_date` and `max_date` params default to a rolling window of today minus 3 days through today plus 14 days.

## Environment variables

Set these in Netlify for Supabase-backed persistence:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the service role key to browser code. The dashboard reads cached earnings from server/API code. If Supabase is not configured, the local collector writes and the app falls back to `public/data/unusual-whales/earnings-calendar.json`.

## Database setup

Apply `supabase/migrations/0002_unusual_whales_earnings.sql`. It creates:

- `unusual_whales_earnings_events`
- `data_refresh_metadata`

The row id is stable: `uw-earnings:{symbol}:{report_date}:{report_time}`.

## Refreshing data

Manual local/server refresh:

```bash
npm run fetch:uw-earnings -- --min_date 2026-06-01 --max_date 2026-06-06 --write-fallback
```

Netlify functions:

- `/.netlify/functions/fetch-uw-earnings` refreshes the cache and is configured with `* * * * *` so Netlify can run it every minute where scheduled functions are available for the site/plan.
- `/.netlify/functions/get-uw-earnings` returns a small frontend-safe cached JSON payload with filters (`min_date`, `max_date`, `symbol`, `sp500_only`, `has_options`, `limit`, `order`).

Netlify scheduled functions use cron expressions in UTC. If a deployed Netlify setup or plan does not run one-minute schedules reliably, keep the manual function endpoint enabled and trigger it every minute from GitHub Actions cron, cron-job.org, EasyCron, Upstash QStash, Supabase cron/pg_cron, or another scheduler.

## Change detection

The refresh job normalizes rows, sorts them deterministically, hashes the normalized payload, compares that hash to `data_refresh_metadata`, and skips row upserts when the payload is unchanged. When data changes, it upserts only rows whose row-level `content_hash` differs.
