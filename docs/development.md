# Development guide

This document is for future developers and Codex agents working in the repository.

## Required documentation maintenance

Documentation is part of implementation, not optional cleanup.

Whenever a change modifies user-facing behavior, data flow, UI, scripts, APIs, environment variables, deployment settings, data sources, backend/serverless functions, schemas, styling patterns, or architecture, update the relevant documentation in the same change.

- Update `README.md` when the user experience, available tabs, data freshness caveats, setup, or deployment story changes.
- Update `docs/features.md` when tabs, pages, components, route behavior, or visible UI flows change.
- Update `docs/data-sources.md` when sources, adapters, caching, fallbacks, schemas, scripts, or provider contracts change.
- Update `docs/architecture.md` when routing, structure, backend/serverless patterns, Supabase usage, or shared architecture changes.
- Update `docs/deployment.md` when Netlify/build/runtime/environment expectations change.
- Update `docs/codex-guidelines.md` when development rules or agent workflows change.

## Local setup

Requirements:

- Node.js 20 or newer.
- npm.

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build production app:

```bash
npm run build
```

Start a production build locally:

```bash
npm run start
```

## Package scripts

Current scripts from `package.json`:

| Script                   | Command                                           | Purpose                                                                                                              |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `dev`                    | `next dev`                                        | Start local Next.js development server.                                                                              |
| `build`                  | `next build`                                      | Build production Next.js app.                                                                                        |
| `start`                  | `next start`                                      | Serve a built Next.js app.                                                                                           |
| `lint`                   | `next lint`                                       | Run Next lint integration. Note: this may need updates because newer Next.js versions no longer support `next lint`. |
| `typecheck`              | `tsc --noEmit`                                    | Type-check the project.                                                                                              |
| `format`                 | `prettier --check .`                              | Check formatting.                                                                                                    |
| `format:write`           | `prettier --write .`                              | Apply formatting.                                                                                                    |
| `fetch:uw-earnings`      | `tsx scripts/fetchUnusualWhalesEarnings.ts`       | Refresh Unusual Whales earnings and optionally write fallback JSON.                                                  |
| `test`                   | `npm run typecheck`                               | Test alias currently runs typecheck only.                                                                            |
| `validate:news-calendar` | `sucrase-node scripts/validateNewsCalendarUi.tsx` | Validate News & Calendar date-selection behavior.                                                                    |

## Validation expectations

For documentation-only changes, run at least:

```bash
npm run typecheck
npm run lint
npm run build
```

Also run feature-specific checks when relevant:

```bash
npm run validate:news-calendar
npm run format
```

If a command fails because of an existing toolchain issue or environment limitation, capture the exact failure and document it in the final response.

## Environment variables for development

Local `.env*` files are intentionally untracked. Configure only what you need.

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
FRED_API_KEY=
SCRAPER_ENABLED=
```

Guidelines:

- Never expose server-only provider keys with `NEXT_PUBLIC_`.
- Supabase persistence requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `SUPABASE_ANON_KEY` is listed in UI/status references but the current server Supabase client uses the service role key.
- Missing API keys should produce fallback/unavailable behavior, not browser-secret exposure.

## Where to make common changes

### Add or change a route/tab

1. Add or edit the page under `app/`.
2. Add/update a dashboard component under `components/dashboard/`.
3. Update navigation in `lib/constants/navigation.ts` if it is a navigable tab.
4. Add/update schemas in `lib/data/schemas/` if an API payload changes.
5. Add/update API route under `app/api/` if internal fetch access is needed.
6. Update docs: `README.md` for user-facing tab changes and `docs/features.md`/`docs/architecture.md` for technical details.

### Change Today data

Primary files:

- `lib/data/live-dashboard.ts`
- `components/dashboard/today/today-view.tsx`
- `app/overview/today/*`
- `app/api/today/route.ts`
- `lib/data/schemas/dashboard.ts`
- `lib/data/fixtures/mock-dashboard.ts`

Protect these distinctions:

- Today featured articles are not the same as News & Calendar headline feed.
- Today earnings are current-ET-date major earnings and are displayed compactly.
- Today economic events are only current-ET-date events.
- Today reuses Markets sector data for leading sectors.

### Change Markets data or heatmaps

Primary files:

- `lib/data/live-dashboard.ts` (`quoteSymbols`, `heatmap()`, `getMarketsPayload()`).
- `lib/data/adapters/finnhub-key-router.ts`.
- `components/dashboard/markets/markets-view.tsx`.
- `components/ui/heatmap.tsx`.
- `lib/data/adapters/unusual-whales-sp500-heatmap.ts` for the persisted S&P 500 heatmap, participation/advancer breadth, and movers dataset.
- `lib/data/daily-candles.ts`, `lib/data/daily-candle-refresh.ts`, and `lib/data/market-breadth-candles.ts` for server-side daily candle normalization, retention, Finnhub/Unusual Whales refreshes, and candle-derived S&P 500 breadth calculations.
- `lib/constants/asset-icons.ts`.
- `public/assets/heatmap-icons/`.

When adding symbols:

1. Add quote symbol metadata in `quoteSymbols`.
2. Add an icon file in `public/assets/heatmap-icons/` if needed.
3. Add/update mappings in `lib/constants/asset-icons.ts`.
4. Update `docs/data-sources.md` if the symbol universe changes materially.
5. For S&P 500 constituent heatmaps, keep S&P 500 heatmap provider fetching server-side in `refresh-markets-heatmap`; breadth now derives from `sp500_daily_candles` after daily Finnhub candle ingestion; the UI must read from the Supabase-backed Markets payload and candle API.

### Change News & Calendar data

Primary files:

- `lib/data/live-dashboard.ts` (`getNewsCalendarPayload()`, economic helper functions).
- `lib/data/adapters/unusual-whales-news.ts`.
- `lib/data/adapters/unusual-whales-earnings.ts`.
- `lib/data/adapters/investing-economic-calendar.ts`.
- `components/dashboard/news-calendar/news-calendar-view.tsx`.
- `scripts/validateNewsCalendarUi.tsx`.

Validate date selector changes with:

```bash
npm run validate:news-calendar
```

Protect these distinctions:

- News headline feed and Today featured articles are separate.
- News & Calendar earnings and Today earnings are separate presentations of shared Unusual Whales source data.
- Economic calendar date-selection behavior depends on local browser dates in the UI and ET dates in server orchestration; be explicit if changing time-zone behavior.

### Change earnings pipeline

Primary files:

- `lib/data/adapters/unusual-whales-earnings.ts`
- `lib/data/earnings-utils.ts`
- `netlify/functions/fetch-uw-earnings.ts`
- `netlify/functions/get-uw-earnings.ts`
- `scripts/fetchUnusualWhalesEarnings.ts`
- `public/data/unusual-whales/earnings-calendar.json`
- `supabase/migrations/`

Run or document why you did not run:

```bash
npm run fetch:uw-earnings -- --write-fallback
```

Only update fallback JSON when intentionally refreshing source data.

### Change economic calendar pipeline

Primary files:

- `lib/data/adapters/investing-economic-calendar.ts`
- `lib/data/config/included-economic-events.ts`
- `lib/data/economic-surprise.ts`
- `lib/data/live-dashboard.ts`
- `components/dashboard/news-calendar/news-calendar-view.tsx`

Run:

```bash
npm run validate:news-calendar
```

### Change fixture-backed pages

Primary files:

- `lib/data/fixtures/mock-dashboard.ts`
- `components/dashboard/flow-ownership/flow-ownership-view.tsx`
- `components/dashboard/sentiment/sentiment-view.tsx`
- API routes for those pages.

If converting a fixture-backed page to live data, update docs to remove “fixture-backed” status and document the new source, fallback rules, env vars, and validation steps.

## Data schemas and API response rules

- Shared primitives live in `lib/data/schemas/common.ts`.
- Dashboard payload schemas live in `lib/data/schemas/dashboard.ts`.
- API routes should validate payloads with `dashboardJson()` where practical.
- Do not return provider secrets or raw secret-bearing URLs to the browser.
- Keep `mode` and `notices` meaningful when live data is partially unavailable.

## Styling conventions

- Use Tailwind tokens from `tailwind.config.ts` (`page`, `sidebar`, `panel`, `borderStrong`, `textPrimary`, `textSecondary`, `textMuted`, `accentBlue`, `positive`, `negative`, `warning`, `neutral`).
- Prefer existing UI primitives before creating new containers/tables/cards.
- Preserve the compact, square, data-dense dashboard style unless product direction changes.
- Use responsive grids; verify narrow widths because the desktop sidebar is replaced below `lg` by a sticky horizontal primary-tab bar.
- Do not introduce a new design system without updating `docs/architecture.md` and `docs/features.md`.

## Code style rules

- Do not wrap imports in `try/catch` blocks.
- Keep provider calls server-side unless a provider is explicitly safe for browser use.
- Prefer graceful fallback returns over throwing from page-level data functions.
- Keep public/static fallback data clearly identified as fallback, not live.
- Be conservative when documenting source status.

## Manual documentation audit checklist

Before finishing a docs-impacting change, verify:

1. README still describes the current visible site.
2. Current tabs and routes are documented.
3. Active vs fixture-backed data is not overstated.
4. Data sources, env vars, scripts, APIs, serverless functions, and deployment settings match code.
5. Internal links in docs work.
6. Unsupported/future features are labeled as fixture-backed, placeholder, planned, or not active.

## Local snapshot-cache behavior

Local development does not require Supabase. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are missing, dashboard payload functions log a snapshot-cache miss and keep using the existing live/mock fallback builders. To test the production-like path locally, configure those server-only variables, run the Netlify refresh functions or call `refreshDashboardSnapshot()`, then inspect `/api/cache/status`.

### Local cache debugging

Use `/api/cache/status` to detect false-success cache states. A healthy local or deployed Supabase-backed run should show row counts that agree with recent metadata; if metadata has a positive `row_count` but a source table count is zero, run the matching refresh function and inspect its `ok`, `persisted`, `upserted`, and `error` fields.

## Cache status debugging

When Supabase-backed refreshes fetch provider data but fail to persist, check `/api/cache/status`. It returns only non-secret diagnostics: Supabase configured state, table counts, expected/missing schema checks, latest metadata errors, snapshot keys, snapshot freshness, and payload sizes. Missing table/column diagnostics usually mean the repo migration exists but production Supabase has not been patched; run `supabase/manual/apply-cache-schema-fix.sql` in the Supabase SQL Editor, then retry Netlify refresh functions.

## Flow/Ownership development notes

Local development can render Flow and Ownership without Supabase by using fixtures. With `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` configured, `/api/flow` reads `flow:latest` first, then `unusual_whales_dark_pool_flows`, `unusual_whales_whale_feed`, and `unusual_whales_insider_trades`, then section-level fixtures. Do not call Unusual Whales from client components; use Netlify functions/adapters. Whale Feed is Supabase-backed from `unusual_whales_whale_feed` when rows exist. Institutional/13F and Congressional data remain fixture-backed under Ownership until endpoints/providers are added.

### Local Flow ingestion checks

When testing with Supabase credentials locally or via Netlify, use `refresh-dark-pool`, `refresh-whale-feed`, `refresh-insider-trades`, and `refresh-flow`, then inspect `/api/cache/status`. The status endpoint includes Flow table counts, latest metadata for `unusual_whales_dark_pool_flows`, `unusual_whales_insider_trades`, and `flow:latest`, dark-pool `emptyReason`, dark-pool retention days and 14-day summary window, insider duplicate-removal counts, insider lookback months, Flow insider rows used, aggregate company counts, and snapshot freshness. Zero dark-pool rows require checking `emptyReason` and response-path diagnostics; insider duplicate counts should be removed before upsert and should not cause a Postgres `ON CONFLICT DO UPDATE command cannot affect row a second time` error.

### Flow aggregation helper notes

Use `lib/data/insider-aggregation.ts` for all insider company aggregate views and API payloads. Do not duplicate ticker aggregation in components. The helper filters to the past 6 months, sorts by trade count then absolute net value, and calculates weighted average trade price as `sum(abs(shares) * price) / sum(abs(shares))`. Use `lib/utils/time.ts` Eastern formatting helpers for user-facing Flow timestamps; do not change process timezone or Supabase storage timezone.

### Flow Summary helper

Flow Summary calculations live in `lib/data/flow-summary.ts`. The helper derives the three Flow Summary mini-card payloads and displays Insider Sentiment as `purchaseValue / (purchaseValue + saleValue)` percentage using the same insider trade rows as the Insider Trades card. Keep the neutral band documented in code (`> 0.505` Bullish, `< 0.495` Bearish, otherwise Neutral) and preserve fixture fallback without allowing mock data to overwrite real Supabase source rows.

### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` on weekdays; a Toronto runtime guard runs provider work every hour Monday-Friday and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page supports client-side View more in batches of 10 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (14D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 14 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (14D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.

Dark Pool expanded view initially shows 15 rows and reveals 30 additional rows per View more click, matching Whale Feed pagination while preserving Dark Pool-specific data logic. Institutional Holdings list tables display full `name`, while institution detail compact titles display `short_name` with a fallback to full `name`. Detail `% of Portfolio` uses cached `perc_of_share_value * 100` as a neutral unsigned percentage. Compare-to-SPY return popups render in a foreground portal layer to avoid clipping by table/card containers. Option holdings persist `put_oi` and `call_oi` from the nested Unusual Whales `oi` object, including JSON-string `oi` payloads, so `% of OI` uses `units / put_oi` for puts and `units / call_oi` for calls. Activity ingestion logs safe per-institution fetch, normalize, upsert, and skip counts. The Institution Detail Stock Holdings UI hides zero-unit positions and displays current position Value as `units * close` from cached holdings data, showing `—` when `close` is unavailable instead of falling back to stale report-date pricing. The Institution Detail Activity UI shows row-level activity records without aggregating duplicate tickers, excludes `Warrant` rows case-insensitively, capitalizes activity labels, colors positive activity green and negative activity red, labels the price movement column `Δ Price Since Activity`, shows signed `Change in Value` as `units_change * price_on_report` immediately after Change in Units, and sorts by largest row-level displayed value (`units * close`) with missing values last. Activity ingestion now keeps only each institution's latest available `report_date` quarter, logs latest-quarter keep/skip counts, and the Supabase cleanup migration `0024_tracked_activity_latest_quarter_cleanup.sql` removes older-quarter and Warrant activity rows from `unusual_whales_tracked_institution_activity`.

### Congressional Holdings live cache

Congressional Holdings refreshes server-side through `refresh-congressional-portfolios`. The job fetches all rows from `https://phx.unusualwhales.com/api/portfolios_v2`, reads list rows from `json.etfs`, normalizes politician names and stores the decimal-return `ytd_return` unchanged for UI display scaling, skips missing/non-numeric returns, applies the manual blacklist (`William Harnisch`, `Donald McEachin`, `Ray Dalio`), dedupes by normalized politician key while keeping the highest valid `ytd_return`, then stores only the final top 20 politicians in `unusual_whales_congressional_portfolios`. The public list endpoint is not called from browser code and is not limited with a top-20 provider query. Trade normalization reads the `asset`/`assets`/`asset_type` provider field into the Supabase `asset` column, skips only normalized `bond`, `corporate bond`, `municipal-security`, and `other`, preserves null/empty/missing asset rows, and keeps the rolling 3-year retention rule.

For each cached top-20 politician, the refresh then calls `https://phx.unusualwhales.com/api/senate_stocks/{encodedPoliticianName}?limit=500`, for example `https://phx.unusualwhales.com/api/senate_stocks/Nancy%20Pelosi?limit=500`. Profile fields (`full_name`, `current_chamber`, `current_party`, `current_district`, `bio`) are stored on the portfolio row and minimal `json.senate_stocks` trade rows (`symbol`, `transaction_date`, `asset`, `amounts`, `txn_type`) are stored separately in `unusual_whales_congressional_trades` only when the trimmed, case-insensitive asset type is not `bond`, `corporate bond`, `municipal-security`, or `other`, and `transaction_date` is within the most recent 3 years of the refresh date. Politicians with no trade rows are logged as `congressional_no_trade_rows_found` and do not fail the refresh; the portfolio/profile row is still upserted when valid. Diagnostics report safe list fetch status, raw/normalized/blacklisted/duplicate/deduped/top-20 counts, duplicate names encountered, per-politician profile status and trade counts, portfolio/trade upsert counts, and skipped-row reason totals without logging secrets or raw payloads.

The Ownership Congressional Holdings card displays the top 5 by YTD return with a View All link to the top 20. Politician detail pages show profile information with capitalized Chamber/Party labels, a shared-style Compare-to-SPY YTD return popup backed by Yahoo Finance/current-market SPY YTD data, and a grouped stock table titled `Top Volume Trades by Stock` sorted by total disclosed transaction volume. Amount ranges such as `$500,001 - $1,000,000` are parsed and summed by lower/upper bounds across buys and sells; malformed amounts are skipped from volume math with safe client diagnostics. Ticker drilldowns show all retained cached Supabase trades for that politician and selected `symbol`, sorted newest first, with Date, Ticker, display-capitalized Asset, Type, and Amount columns; Type text follows the row transaction direction (purchases/buys green, sales/sells red, unknown muted), while Asset is display-capitalized but not transaction-colored. The grouped stock table colors Purchases green and Sales red, while the politician title and bio align naturally and only the metadata row is centered.

Legacy scraper Market Breadth provider caches (`market_breadth_cache`, `barchart_market_breadth`, `market_breadth`, `%_above_ma`, and `52w_high_low`) are removed by an additive migration. New breadth values are calculated from `sp500_daily_candles`.

### Daily candle backfill, refresh, and validation

Run the temporary stock/market backfill only from a server environment with service-role Supabase credentials and Unusual Whales credentials:

```bash
ENABLE_UW_CANDLE_BACKFILL=true npx tsx scripts/backfillDailyCandlesFromUnusualWhales.ts --group all --start-index 0 --limit 25
```

The stock/market historical Unusual Whales endpoint is temporary and isolated to that script plus tests/docs. To confirm it is not used by normal code, search for `ticker_candles/` and verify no page route, `/api/markets/candles`, or scheduled Finnhub daily refresh references it.

Permanent refresh jobs are `refresh-daily-market-candles` (Finnhub-only for S&P 500 and fixed Markets assets, one paced lane per distinct key, 30 calls/minute/key) and `refresh-daily-crypto-candles` (Unusual Whales crypto candles for only the eight configured crypto heatmap assets). Validate stored coverage with:

```bash
npx tsx scripts/verifyDailyCandles.ts
```

### Crypto daily candle diagnostic and verification

Use `npx tsx scripts/debugUnusualWhalesCryptoCandles.ts --symbol=BTCUSD` for the configured BTC endpoint, or omit `--symbol` for all eight uppercase mappings (`BTCUSD/BTC-USD`, `ETHUSD/ETH-USD`, `SOLUSD/SOL-USD`, `XRPUSD/XRP-USD`, `BNBUSD/BNB-USD`, `TRXUSD/TRX-USD`, `ADAUSD/ADA-USD`, `DOGEUSD/DOGE-USD`). The temporary repair fetch start date is `2025-07-10`; return it to a dynamic one-year start only after Supabase coverage is confirmed in production. The script prints only sanitized diagnostics and requires no browser access to Unusual Whales.

Before running `refresh-daily-crypto-candles`, apply migration `0037_daily_candle_volume.sql` so all candle tables include nullable `volume numeric`. The function uses no Unusual Whales API key when present, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. It fails before provider requests if `crypto_daily_candles` or `volume` is unavailable.

## Markets candle verification checklist

Use Supabase as the source of truth for historical OHLCV charts. Browser code must call only `/api/markets/candles`; it must not call Unusual Whales, Finnhub, or privileged Supabase APIs. Empty chart responses are not cacheable and must render an unavailable state instead of fixture candles. Real chart responses include source metadata such as `Unusual Whales Crypto` or `Unusual Whales Equity`, provider symbol, table, earliest/latest trading dates, and row count for diagnostics, but the chart modal header does not render that metadata line. The modal defaults to `1W`; supported ranges are `1W`, `1M`, `3M`, `YTD`, and `1Y`, while daily `1d` resolution remains valid for current stored rows. The chart keeps a fixed non-resizable price/volume separator and a top-left OHLCV legend.

For equity historical validation, run targeted script invocations before a broad S&P 500 run:

```bash
tsx scripts/backfillDailyCandlesFromUnusualWhales.ts --group sp500 --symbol AAPL --force
tsx scripts/backfillDailyCandlesFromUnusualWhales.ts --group markets --symbol SPY --force
```

Then compare Supabase rows with `/api/markets/candles?symbol=AAPL&range=1Y` or `/api/markets/candles?symbol=SPY&range=1Y`. Do not claim a visible chart is real until API first/latest candles have been compared with stored Supabase rows.

### Performance continuation checks

Use production or deploy-preview browser traces to compare `/overview/today` before and after loading changes. Verify that navigation links render with `prefetch={false}`, deferred prefetch starts after load+idle, constrained networks skip background warming, loading skeletons appear on route transitions, and Ownership renders a table skeleton while `/api/ownership/institutional` is pending.

### Local equity candle checks

Use `npm run audit:equity-candles`, `npm run backfill:equity-candles`, and `npm run verify:equity-candles` for the equity candle workflow. Backfill supports `--table`, `--symbol`, `--from`, `--to`, `--limit-symbols`, and `--dry-run`. Daily refresh must remain incremental and preserve existing rows on provider failure. Do not reintroduce Finnhub `/api/v1/quote` as a historical daily candle source.


AlphaDigest does not use an Unusual Whales API key for candle ingestion. Public provider requests originate only in server-side ingestion modules, send no authorization header, persist normalized candles in Supabase, and frontend charts read cached AlphaDigest data rather than provider URLs.

### Equity-candle backfill development

Use the read-only `npm run audit:equity-candles` before a repair. Historical backfill is separate from the daily refresh: it uses checkpoint rows, atomic five-symbol claims, post-write coverage verification (at least 253 daily rows), and public server-side Unusual Whales requests without credentials. Do not call provider URLs from client modules.
