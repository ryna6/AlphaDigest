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

### Economy and Sentiment

Economy and Sentiment are separate top-level tabs. Economy contains macro regime, rates, inflation, labor, oil/geopolitical risk, and liquidity sections. Sentiment contains sentiment/positioning indicators plus a Market Expectations section that shows a clean empty state until existing cached sources support live content. Today’s Earnings shows highest-priority market-cap importance subtext when earnings exist, and shared info popover body text is slightly smaller for dense explanations.

### Methodology and Status

Methodology lists intended source coverage and environment variable names. The Status tab is a server-rendered job monitoring page grouped by dashboard tab. It keeps the table columns to Job, Status, Source, Schedule, Last Run, and Next Run; the Job cell shows both the user-facing component name and the actual Netlify function/job name, the Source cell shows short safe provider names, not raw endpoints, and the Status cell is center-aligned. Status rows read fresh Supabase `job_runs` telemetry for Last Run and health, calculate the next run from the central status job registry schedules, display times under the note “All times are shown in Eastern Standard Time.” without repeating timezone suffixes in each cell, and keep planned TBD jobs Unknown rather than Healthy. The Status page/API use dynamic no-store behavior, the page auto-refreshes every 5 minutes while open, and browser refreshes should fetch current telemetry without redeploy. Component status labels render as Good/Healthy, Warning/Stale or delayed, Critical/Action required, and Offline/No status available. Future automated jobs should be added to `lib/status/jobs.ts` and instrumented with `lib/status/job-runs.ts`; `job_runs` rows older than 24 hours are pruned server-side during telemetry writes via the tracked no-argument `public.cleanup_old_job_runs()` Supabase RPC; schedules that need Eastern/Toronto precision should use the shared Toronto runtime guard rather than fixed UTC offsets. Secret values are never shown in the browser. The desktop sidebar and mobile primary-tab bar remain available while scrolling.

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
- Some dashboard areas are intentionally fixture-backed today, especially Whale Feed, Ownership, Economy and Sentiment, and ticker detail data.
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

Flow and Ownership are now separate primary tabs. Flow contains a three-card Flow Summary, plus full-width Insider Trades, Dark Pool, and Whale Feed rows. Ownership contains tracked Institutional positioning and Congressional Holdings. Dark pool and insider trades are fetched server-side from Unusual Whales by Netlify scheduled functions and cached in Supabase; browser components never call Unusual Whales directly and never receive `SUPABASE_SERVICE_ROLE_KEY`.

Dark pool uses the large-print Unusual Whales filter endpoint once daily and retains up to 14 days of rows in `unusual_whales_dark_pool_flows`; the current plan is expected to return roughly two-day delayed data. Insider trades use up to four server-side pages (up to 2,000 rows) from the provided corporate-insider endpoint once daily, store only normalized transaction fields in `unusual_whales_insider_trades`, and UI/API reads filter to the past 6 months. Dark Pool displays execution time as `MM/DD HH:mm` in Eastern Time and ticker detail pages show all available same-ticker prints sorted by most recent execution time first. Flow Summary replaces Top insider activity with Insider sentiment, displayed as `purchaseValue / (purchaseValue + saleValue)` percentage and labeled Bullish, Bearish, or Neutral. The Flow insider card and Insider sentiment both use the same full Supabase-backed 6-month insider row population as `/flow/insider-trades`; the main card slices the shared aggregate to the top 5, while `/flow/insider-trades` initially shows the top 25 and can reveal up to the top 50 with View more, and `/flow/insider-trades/[ticker]` shows individual transactions. Whale Feed is Supabase-backed from its server-side refresh table when rows exist. The Ownership Institutional Holdings card reads the tracked-institution Supabase cache, shows the top 5 institutions by latest total value, and links to a full tracked-institution list plus dedicated institution detail pages; Congressional Holdings use the server-side no-auth Unusual Whales `portfolios_v2` refresh from `json.etfs` into `unusual_whales_congressional_portfolios`, blacklist known broken/non-politician rows (`William Harnisch`, `Donald McEachin`, and `Ray Dalio`), dedupe normalized politician keys before upsert, and store only the top 20 politicians by the decimal-return `ytd_return`; the main card shows the top 5 and View All shows the cached top 20. Congressional trade refreshes skip only the normalized asset types `bond`, `corporate bond`, `municipal-security`, and `other`, preserve null/empty/missing asset rows, and retain trades from the rolling last 3 years, with the same safe cleanup captured in Supabase migrations. Browser UI reads only the cached Congressional API, capitalizes chamber/party and ticker-drilldown Asset display values, scales Congressional decimal YTD returns by 100 for display, compares Congressional YTD returns against Yahoo Finance/current-market SPY YTD data instead of Institutional quarterly SPY history, shows the Congressional YTD Returns info popover text beside YTD labels, colors transaction-direction fields such as purchases/buys and sales/sells green/red, leaves Asset uncolored, and shows unavailable chamber/party/district/asset fields as `—`.

Apply `supabase/manual/apply-unusual-whales-flow.sql` in the Supabase SQL Editor before running `refresh-dark-pool`, `refresh-whale-feed`, `refresh-insider-trades`, `refresh-flow`, or `refresh-institutional-portfolios` in Netlify. `/api/cache/status` reports the new source tables and `flow:latest` / `ownership:latest` snapshots.

Flow refresh diagnostics now distinguish provider/fetch success from data persistence success. `refresh-dark-pool` logs safe Unusual Whales response-shape diagnostics, including the observed `{ trades: [...] }` dark-pool shape and records `emptyReason` when zero rows are returned or all rows are skipped; dark-pool cache rows are retained for 14 days. `refresh-insider-trades` filters to the past 6 months, applies purchase/sale signs deterministically, creates stable upsert IDs, dedupes rows before Supabase upsert, and records duplicate-removal counts. `refresh-flow` may persist a partial `flow:latest` snapshot when one source succeeds, but logs source statuses and notices clearly. Use `/api/cache/status` after deployment to verify Flow row counts, metadata errors, dark-pool empty reasons, insider duplicate counts, `flow:latest` freshness, the 6-month insider rows used by Flow, insider aggregate counts, and the 14-day dark-pool retention/window.

### Flow UI updates

The Flow tab includes View All pages for Dark Pool, Whale Feed, and Insider Trades. Insider Trades on `/flow` shows the top 5 real Supabase-backed company aggregates when cached rows exist; `/flow/insider-trades` initially shows the top 25 and can reveal up to the top 50 with View more using the same aggregation helper and sort order. The weighted average trade price is calculated by shares as `sum(abs(shares) * price) / sum(abs(shares))`. Individual insider ticker pages include `shares_owned_after` in the far-right detail column. Flow timestamps are displayed in Eastern Time (`ET`) while Supabase timestamp storage remains UTC/timestamptz.

Flow card navigation and fallback behavior were tightened so expanded-page Back controls sit in card header action areas, date-only insider transaction fields omit `ET`, and `/flow` rebuilds from Supabase source tables instead of trusting a fresh mock or stale pre-diagnostics `flow:latest` snapshot when real cached rows may exist. Flow Summary mini cards are clickable where a destination exists and use the same hover-lift cursor treatment as Markets heatmap tiles; the dark-pool summary title reflects the current 14-day retention as `Largest Dark Pool Print (14D)` and displays ticker left with premium beside it.

### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` on weekdays; a Toronto runtime guard runs provider work every hour Monday-Friday and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page initially shows 15 server-loaded rows and supports client-side View more in batches of 15 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (7D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 7 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (14D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.

Status schedule notes: Congressional Holdings / `refresh-congressional-portfolios` runs daily (`0 10 * * *`) with source `Unusual Whales`; Market Overview / `refresh-market-quotes` runs every 5m from the start of Sunday through the end of Friday in Toronto/Eastern time (`*/5 * * * *` with a Toronto weekday guard); Put/Call Ratio / `refresh-put-call` runs every 30m Monday-Friday (`*/30 * * * 1-5`); Top News / `refresh-featured-articles` and Unusual Whales News Feed / `refresh-news-feed` run every 30m daily (`*/30 * * * *`); Today’s Economic Events / `refresh-economic-events` and Today’s Earnings / `fetch-uw-earnings` run every 6h daily (`0 */6 * * *`); Indices/Heatmaps / `refresh-markets` runs every 5m Monday-Friday (`*/5 * * * 1-5`); Insider Trades, Dark Pool, and Whale Feed run hourly Monday-Friday (`0 * * * 1-5`); `refresh-flow` wakes hourly at :05 (`5 * * * *`) and its Toronto weekday guard allows Monday-Friday provider work; source labels stay short and safe; and the Status note says `All times are shown in Eastern Standard Time.` Netlify may show platform-generated wording for cron expressions, so docs record both the actual cron and intended human-readable schedule.

### Ownership Institutional data wiring

Institutional Summary reads cached Supabase data via `/api/ownership/institutional`; browser code never calls Unusual Whales institutional endpoints or receives service-role credentials. Netlify runs `refresh-institutional-summary` daily at `0 8 * * *` to fetch institutional ticker-flow and sector-exposure data server-side and upsert `unusual_whales_institutional_ticker_flow` plus `unusual_whales_institutional_sector_exposure`. Ticker-flow rows retain only `investor_type`, `order`, `ticker`, `value`, `increased_positions`, `decreased_positions`, `holding_count`, `units`, `prev_units`, and freshness metadata. Sector exposure rows retain only `investor_type`, normalized State Street sector labels, `value`, `report_date`, and freshness metadata, filtered before persistence to each investor type's latest five valid quarter-end reports. The Ownership Institutional Summary keeps the investor-type selector for all cards and adds an Increased/Decreased/New/Sold Out selector scoped only to the middle positions card. The summary displays the latest cached sector report date when available, renders holdings and position-change data as compact tables whose QoQ Δ is calculated as `units - prev_units`, and renders sector exposure as a legend-free pie chart with an outside-positioned tooltip limited to sector label and percentage share plus a compact list with exact labels like `XLF (Financials)` and `XLC (Communications)`, share, QoQ percentage-point share change, and YoY percentage-point share change when enough cached report dates exist. The Investor Types modal scroll-locks background body scrolling while preserving X, Escape, and outside-click close behavior. The Top Positions control is compact and right-aligned below the card title, and the Top Holdings/Top Positions tables use larger row spacing with matching control-row alignment so the cards feel balanced without adding fake data or extra spacing to Sector Breakdown. The desktop sidebar is narrower without changing the mobile nav.

Tracked Institutional data now powers the Ownership Institutional Holdings card. `/api/ownership/institutional` returns cached Supabase rows for the curated institutions while the Netlify `refresh-institutional-portfolios` function resolves Unusual Whales provider names server-side, fetches stock/fund holdings with `slim=true`, option holdings from the Option endpoint with `slim=true`, and activity rows, then writes only the retained fields to Supabase. Latest institution info stays in `unusual_whales_tracked_institutions`; the trailing 21 quarter-end reports / 5 years of historical `total_value` and `spy_price` are stored in `unusual_whales_tracked_institution_history`. The refresh also fetches `https://phx.unusualwhales.com/api/institutions/{institutionSlug}` server-side to persist historical `total_value` and `spy_price` in `unusual_whales_tracked_institution_history` for institution-vs-SPY YTD, 1Y, and 5Y returns. Browser code does not call Unusual Whales directly.

Dark Pool expanded view initially shows 15 rows and reveals 30 additional rows per View more click, matching Whale Feed pagination while preserving Dark Pool-specific data logic. Institutional Holdings list tables display full `name`, while institution detail compact titles display `short_name` with a fallback to full `name`. Detail `% of Portfolio` uses cached `perc_of_share_value * 100` as a neutral unsigned percentage. Compare-to-SPY return popups render in a foreground portal layer to avoid clipping by table/card containers and are reused by Congressional YTD return cells. Option holdings persist `put_oi` and `call_oi` from the nested Unusual Whales `oi` object, including JSON-string `oi` payloads, so `% of OI` uses `units / put_oi` for puts and `units / call_oi` for calls, displays as an unsigned neutral percentage, and highlights values above 25% in green. Activity ingestion reads the endpoint `data` array, safely normalizes numeric strings/nulls, allows nullable buy/sell prices and security type, and logs safe per-institution fetch, normalize, upsert, and skip counts. The Institution Detail Stock Holdings UI hides zero-unit positions and displays current position Value as `units * close` from cached holdings data, showing `—` when `close` is unavailable instead of falling back to stale report-date pricing. The Institution Detail Activity UI shows row-level activity records without aggregating duplicate tickers, excludes `Warrant` rows case-insensitively, capitalizes activity labels, colors positive activity green and negative activity red, labels the price movement column `Δ Price Since Activity`, shows signed `Change in Value` as `units_change * price_on_report` immediately after Change in Units, and sorts by largest row-level displayed value (`units * close`) with missing values last. Activity ingestion now keeps only each institution's latest available `report_date` quarter, logs latest-quarter keep/skip counts, and the Supabase cleanup migration `0024_tracked_activity_latest_quarter_cleanup.sql` removes older-quarter and Warrant activity rows from `unusual_whales_tracked_institution_activity`.

Earnings Calendar refreshes (`fetch-uw-earnings`) retain only `unusual_whales_earnings_events.report_date` rows inside the active window: Monday of the previous week through Friday of the next week in Toronto/Eastern time. Each server-side refresh prunes cached rows before `min_date` or after `max_date`, continues excluding `market_cap_size = micro`, and logs safe row/prune/skip counts without provider payloads or secrets. The News & Calendar Earnings Calendar card no longer renders the former optional-persistence helper text.
