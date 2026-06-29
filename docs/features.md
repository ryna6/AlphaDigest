# Features and UI flows

This file documents current user-facing features and the files future Codex agents are most likely to edit. Do not add features here unless they exist in code.

## Navigation and shell

- Shell layout: `app/layout.tsx` wraps every route in `DashboardShell`.
- Sidebar/mobile tabs: `components/shell/app-sidebar.tsx` renders the sticky desktop sidebar and sticky mobile primary-tab bar from `lib/constants/navigation.ts`.
- Logo: `components/shell/app-logo.tsx` renders `public/logo.png`.
- Home redirect: `app/page.tsx` redirects `/` to `/overview/today`.

Current primary tabs:

1. Today
2. Markets
3. News & Calendar
4. Flow
5. Ownership
6. Economy
7. Sentiment

Current utility tabs:

1. Methodology
2. Status

## Today tab

Route/component/data:

- Page route: `app/overview/today/page.tsx`.
- View component: `components/dashboard/today/today-view.tsx`.
- Data function: `getTodayPayload()` in `lib/data/live-dashboard.ts`.
- API route: `/api/today`.

The Today page displays:

- Page title and key market stats.
- Market Summary cards:
  - Leading Sectors from the Markets sector heatmap.
  - Risk On / Risk Off from live VIX3M divided by live VIX when both valid positive values are available.
  - Put/Call Ratio from the Cboe current market-statistics source, storing Equity, Index, and Total ratios with Eastern release time; the Today Market Summary card displays only the Total ratio plus its 24h change, while Index and Equity remain available in cached backend data for future tabs. The server-side daily fallback requests Cboe daily statistics with a Toronto-date `?dt=YYYY-MM-DD` query only when intraday parsing is unavailable.
  - Today's Earnings count from the Unusual Whales earnings flow, with highest-priority `market_cap_size` importance subtext (`big` market movers, `large` high impact, `mid` moderate impact, then `small` low impact) when earnings exist. With no earnings, the value remains centered without an empty subtext row.
  - Today's Economic Events count from the Investing.com calendar flow.
- Featured Unusual Whales articles with title, tags, timestamp, and excerpt.
- Today's top earnings, limited to five rows.
- Today's economic events.
- Sector snapshot from the leading sector heatmap tiles.
- Shared `i` info popover body text uses a smaller readable size while preserving the icon size and dark-theme tooltip styling.
- Economy and Sentiment are separate top-level tabs. The sidebar/mobile nav uses monochrome lucide SVG icons for these dashboard tabs: Today `Newspaper`, Markets `TrendingUp`, Economy `ChartColumn`, and Sentiment `Vote`. Economy has 3 compact derived summary cards (Economy Regime, Fed Pressure, Stress Level) and 6 FRED-backed main categories shown one at a time behind a segmented selector (Growth Trend, Inflation, Labor Market, Consumer Health, Rate Pressure, Credit Stress). Growth Trend contains 6 metrics: Real GDP, Retail Sales, Industrial Production, Durable Goods, Personal Consumption, and CFNAI. Main-card metrics are clickable/tappable and update only the taller 10-year mini chart inside their own card. Charts show subtle unit y-axis labels with extra left spacing to avoid overlapping large, compact, negative, index, and percentage tick values, omit the x-axis title while keeping date/quarter tick labels, use whole-number y-axis ticks with padded domains, tooltip labels use real FRED observation dates instead of array indexes and show only date/value, and the selected metric integrates compact spaced details in the chart header as `Range: start to end | Frequency: ... | ...` without `Unit` or `Source: FRED`. Chart titles append the selected FRED series ID, Economy info icons are removed, and metric values render with smaller muted units beside the value plus QoQ and YoY changes on each row; missing values or insufficient change history render `—`. Missing FRED data renders compact placeholders such as `—`; the cards do not repeat noisy placeholder copy. Sentiment starts with a 3-card summary row sourced from existing sentiment metrics, keeps sentiment/positioning indicators below it, and no longer shows top Indicators / Market Expectations buttons.

Important behavior:

- Today shares market data with the Markets tab by calling `getMarketsPayload()`.
- Today earnings are filtered to the current ET date and ranked by `getMajorEarningsForDate()`.
- Today featured articles are separate from the News & Calendar headline feed. Do not accidentally replace one with the other.
- The Top News routes use the Today featured article payload, not the News & Calendar headline payload. Featured article cleanup removes known Unusual Whales promo/ad text snippets after normalization, robust to whitespace and tag-boundary differences, while preserving real article sections before and after the promo text.

Related routes:

- `/overview/today/top-news` shows up to 50 featured articles with a client-side “More” button.
- `/overview/today/top-news/[slug]` shows a detail view for one featured article.

## Markets tab

Route/component/data:

- Page route: `app/markets/page.tsx`.
- View component: `components/dashboard/markets/markets-view.tsx`.
- Data function: `getMarketsPayload()`.
- API route: `/api/markets`.

The Markets page displays:

- Market strip metrics: S&P 500, Nasdaq 100, Mid Cap, Small Cap, and S&P 500 Futures.
- Four switchable heatmaps:
  - Global Markets
  - Sectors
  - Crypto
  - Macro
- Fallback breadth and movers cards from `marketsMock()`.

Important behavior:

- Heatmap groups are defined in `quoteSymbols` inside `lib/data/live-dashboard.ts`.
- Finnhub feature areas are routed through dedicated environment variables by `lib/data/adapters/finnhub-key-router.ts`.
- S&P 500 futures currently comes from Yahoo Finance when available.
- If individual live requests fail, fallback metrics/tiles are used for those positions.
- If all live requests fail, mode is `mock` and notices include missing-key messages.
- Heatmap icon paths come from `getHeatmapIconPath()`; metric icon paths come from `getMetricIconPath()`.

## News & Calendar tab

Route/component/data:

- Page route: `app/news-calendar/page.tsx`.
- View component: `components/dashboard/news-calendar/news-calendar-view.tsx`.
- Data function: `getNewsCalendarPayload()`.
- Main API route: `/api/news-calendar`.
- Selected-day economic API route: `/api/news-calendar/economic?date=YYYY-MM-DD`.

The main page displays:

- Latest Market News: first 12 items from the Unusual Whales headline feed or fallback news.
- Weekday selector for last week, current week, and next week.
- Economic Calendar table for the selected weekday, excluding duplicate exports/imports trade-detail rows while preserving broader Trade Balance events.
- Earnings Calendar grouped as Before Open and After Close.

Subpages:

- `/news-calendar/news` renders `AllNewsView` with up to 100 headlines and a “More” button in increments of 20.
- `/news-calendar/earnings` renders `AllEarningsView` with the same weekday selector and earnings grouping as the main page.

Important behavior:

- The weekday selector only supports three offsets: `-1`, `0`, and `1`.
- Weekend initial selection jumps to Monday of the next week.
- The economic calendar preloads prior/current/next week buckets and fetches missing selected days client-side.
- Economic event rows use `getEconomicActualTone()` to color actual values when the helper can classify surprise direction.
- Earnings rows show symbol, company, put/call ratio, and implied move. The put/call ratio is calculated at display time as retained Unusual Whales `put_volume / call_volume`; missing put volume or missing/zero call volume displays `—`.
- The News & Calendar earnings calendar uses `data.unusualWhalesEarnings` and is distinct from the compact `data.earnings` fallback rows.
- Do not couple News & Calendar earnings behavior to Today's top-five earnings panel; they share source data but have different filtering/display rules.

## Flow tab

- Page route: `app/flow/page.tsx`; API route: `/api/flow`.
- Contains Flow Summary, Dark Pool, Whale Feed, and Insider Trades.
- Flow Summary replaces Big Money Flow Summary and no longer includes Top 13F accumulation because 13F data moved to Ownership.
- Dark Pool is Supabase-backed from the provided Unusual Whales dark-pool endpoint, refreshed once daily, expected to be delayed by roughly two days, and retained for 14 days.
- Insider Trades is Supabase-backed from up to four server-side pages of the provided Unusual Whales insider endpoint, filtered and pruned to the past 6 months by `transaction_date`, aggregated by ticker, with top 5 on the main Flow tab, initial top 25 and View more up to top 50 at `/flow/insider-trades`, and detail rows at `/flow/insider-trades/[ticker]`.
- Whale Feed is Supabase-backed from the server-side Unusual Whales lit-trades whale endpoint, retains rows for 14 days, and uses fixture fallback only when cached rows are unavailable.

## Ownership tab

- Page route: `app/ownership/page.tsx`; API route: `/api/ownership`.
- Contains an Institutional Summary UI with a shared investor-type selector (Value by default, plus Activist, 13D Activist, and Tiger Cub), a visible latest cached report date, compact holdings/position tables, and a sector-exposure pie chart with a compact ETF/sector share breakdown.
- The Investor Types modal opens from the Institutional Summary header, scroll-locks the page background while open, and closes via the X button, Escape, or outside click.
- Contains Institutional positioning and Congressional Holdings data tables below the summary.

#### Flow cache behavior

The Flow tab reads cached Supabase rows/snapshots first and never calls Unusual Whales from browser components. Dark Pool keeps up to 14 days of normalized large-print rows and may show zero fresh rows when the provider is delayed, the plan returns an empty/paywalled response, filters match nothing, or the response shape changes; `/api/cache/status` and Supabase job telemetry expose a safe `emptyReason` instead of treating unexplained zero rows as a silent success. Insider Trades are filtered to the past 6 months, deduped before Supabase upsert, pruned by `transaction_date` after refresh, and keyed with stable deterministic IDs. `flow:latest` can be written with notices when one Flow source succeeds and another fails, but refresh logs identify partial snapshots versus fully fresh snapshots.

### Flow revision details

- `/flow` now exposes View All links for Insider Trades, Dark Pool, and Whale Feed. Expanded section pages use the same Back button pattern as News pages: `/flow/insider-trades`, `/flow/dark-pool`, and `/flow/whale-feed` return to `/flow`, while ticker detail pages return to their parent section.
- The main Flow Insider Trades card uses the same full Supabase-backed 6-month row source and company aggregate helper as `/flow/insider-trades`, limited to the top 5 companies so it exactly matches the first five rows of the expanded view. The expanded Insider Trades page initially shows the top 25 and can reveal up to the top 50 with View more companies.
- Insider company aggregates include trades, purchases, sales, weighted average price, net shares, and net value. The average price is weighted by absolute shares: `sum(abs(shares) * price) / sum(abs(shares))`, skipping zero-share or missing-price rows.
- `/flow/insider-trades/[ticker]` shows individual trades and includes `shares_owned_after` as the far-right column. Aggregate company tables do not display `shares_owned_after`.
- User-facing Flow timestamps and dates are formatted in Toronto/Eastern time (`ET`) via explicit `America/Toronto` formatting; Supabase storage remains UTC/timestamptz or date fields as defined by the cache tables.

### Flow follow-up fixes

- Expanded Flow pages and ticker detail pages place Back controls in the `SectionHeader` action slot, matching the same card-header location used by View All links on the main Flow cards.
- `/flow` bypasses a fresh `flow:latest` snapshot when that snapshot is marked `mock`, rebuilds from Supabase source tables first, and only uses fixture rows when source tables are unavailable or empty. This keeps main Flow Insider Trades and Dark Pool cards aligned with their expanded Supabase-backed pages.
- Insider trade transaction dates are date-only displays and do not append `ET`; Flow date-time values such as dark-pool execution timestamps still display Eastern Time with an `ET` label.

### Flow UI revision

- `/flow` keeps Flow Summary near the top, then renders Insider Trades, Dark Pool, and Whale Feed as separate full-width rows so Dark Pool and Whale Feed text has desktop room while mobile remains stacked.
- Flow Summary now uses three responsive mini cards: Insider sentiment, `Largest Dark Pool Print (14D)`, and Whale Feed. Summary cards link only when a reliable drilldown exists, such as Dark Pool ticker detail, Whale Feed expanded view, or Insider Trades expanded view, and clickable cards use the same hover-lift cursor behavior as Markets heatmap tiles.
- Dark Pool timestamps display in Eastern Time as `MM/DD HH:mm` (for example `06/15 16:00`) on the card, expanded page, and ticker detail views.
- `/flow/dark-pool/[ticker]` is ticker-level: it shows all available same-ticker dark-pool prints from the Supabase source rows, then the cached `flow:latest` snapshot for that ticker when needed, sorted by most recent `executed_at` first, with the Back action returning to `/flow/dark-pool`.
- `Top insider activity` was replaced with `Insider sentiment`. Insider Sentiment uses the same full Supabase-backed 6-month insider row population as the main and expanded Insider Trades views and displays `purchaseValue / (purchaseValue + saleValue)` as a percentage, where sale value is absolute sale value. The UI labels ratios `> 0.505` Bullish, `< 0.495` Bearish, and the small documented neutral band around 0.5 Neutral, with matching color and an info tooltip.

- Flow card subtexts were cleaned up for Insider Trades, Dark Pool, and Whale Feed; the main Dark Pool and Whale Feed card titles include info popovers, and the main Whale Feed Sentiment column includes an info popover explaining Bid/Ask Execution; technical fallback/provider notices continue to use existing mode/notices patterns.

### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify wakes `refresh-whale-feed` on weekdays; a Toronto runtime guard runs provider work every hour Monday-Friday and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are upserted into `unusual_whales_whale_feed` without replacing recent history, pruned only when `executed_at` is older than 14 days, and normalized with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page initially shows 15 server-loaded rows and supports client-side View more in batches of 15 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (7D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 7 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (14D)` summary subtext displays explanatory `% of 30D Vol` text using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.

## Status tab operations

The Status tab presents grouped automated jobs with the columns Job, Status, Source, Schedule, Last Run, and Next Run. The Source column replaces the former Endpoint label and uses short provider names rather than exact URLs or API paths. The component status legend is centered in its card with wider spacing and preserves the Healthy, Warning, Error, Unknown order. Unusual Whales News Feed / `refresh-news-feed` displays `Every 30m, Daily` and runs every 30 minutes on the hour and half-hour; Put/Call Ratio displays `Every 30m, Mon–Fri`; Flow source jobs display hourly Monday-Friday and `refresh-flow` displays `Every 1h at :05, Mon–Fri`.

Status reads fresh Supabase `job_runs` telemetry written by scheduled functions. Last Run and status come from job metadata, Next Run remains schedule-based, and TBD or not-yet-run jobs remain Unknown. The Status page and `/api/cache/status` are dynamic/no-store so a browser refresh fetches current telemetry without redeploy, and the Status page auto-refreshes every 5 minutes while open. Component status labels render as Good/Healthy, Warning/Stale or delayed, Critical/Action required, and Offline/No status available. `job_runs` rows older than 24 hours are pruned server-side during telemetry writes via the tracked Supabase retention helper. Netlify logs are only for manual debugging in the Netlify UI/CLI and no Netlify auth token is required for Status.

Status schedule notes: Market Overview / `refresh-market-quotes` runs every 5m from the start of Sunday through the end of Friday in Toronto/Eastern time (`*/5 * * * *` with a Toronto weekday guard); Put/Call Ratio / `refresh-put-call` runs every 30m Monday-Friday (`*/30 * * * 1-5`); Top News / `refresh-featured-articles` and Unusual Whales News Feed / `refresh-news-feed` run every 30m daily (`*/30 * * * *`); Today’s Economic Events / `refresh-economic-events` and Today’s Earnings / `fetch-uw-earnings` run every 6h daily (`0 */6 * * *`); Indices/Heatmaps / `refresh-markets` runs every 5m Monday-Friday (`*/5 * * * 1-5`); Insider Trades, Dark Pool, and Whale Feed run hourly Monday-Friday (`0 * * * 1-5`); `refresh-flow` wakes hourly at :05 (`5 * * * *`) and its Toronto weekday guard allows Monday-Friday provider work; source labels stay short and safe; and the Status note says `All times are shown in Eastern Standard Time.` Netlify may show platform-generated wording for cron expressions, so docs record both the actual cron and intended human-readable schedule.

### Ownership Institutional data wiring

- Institutional Summary now reads cached Supabase rows through `/api/ownership/institutional`; browser code does not call Unusual Whales or receive service-role credentials.
- The daily Netlify `refresh-institutional-summary` function (`0 8 * * *`) fetches Unusual Whales institutional ticker-flow and sector-exposure endpoints server-side, then upserts `unusual_whales_institutional_ticker_flow` and `unusual_whales_institutional_sector_exposure`.
- Ticker-flow persistence is limited to `investor_type`, `order`, `ticker`, `value`, `increased_positions`, `decreased_positions`, `holding_count`, `units`, `prev_units`, and freshness metadata. Sector exposure persistence is limited to `investor_type`, normalized State Street `sector` labels, `value`, `report_date`, and freshness metadata, filtered to each investor type's latest five valid quarter-end report dates before Supabase writes.
- The Institutional Summary investor-type dropdown updates holdings, position-change, and sector cards. The middle card has its own compact Increased/Decreased/New/Sold Out control below the title that only changes the position card. Holdings and position cards render compact tables with Ticker, Value, # Firms, and QoQ Δ columns, share modest matching title spacing, and calculate QoQ Δ as `units - prev_units`. The sector card renders a legend-free pie chart without the extra Holdings/Positions table spacing; its tooltip stays outside the pie and shows only the normalized State Street sector label plus percentage share. Its compact list uses exact State Street sector ETF labels such as `XLF (Financials)`, `XLY (Consumer Discretionary)`, and `XLC (Communications)`, and its QoQ/YoY columns show percentage-point share changes (`current share - comparison share`) when cached history is available.
- The desktop sidebar was narrowed while retaining padding for tab labels and leaving mobile navigation unchanged.

### Removed Ticker Explorer

Ticker Explorer has been removed from the user-facing app, including navigation, app routes, the ticker API route, and the placeholder Netlify ticker refresh function. Shared fixture utilities remain only where they are still used by other dashboard areas.

### Market Summary 24h changes

Risk On / Risk Off and Put/Call Ratio show a same-row signed whole-percentage 24h change when compact Supabase history has a valid comparison. Positive changes are green, negative changes are red, zero changes are grey, and unavailable comparisons display a muted dash using the existing muted-card convention. Put/Call displays only the numeric total value in the Today card; Index and Equity put/call values continue to be fetched and stored server-side.

### Tracked institutional Ownership card

- The Ownership Institutional Holdings card is backed by 20 curated tracked institutions. Browser code fetches only `/api/ownership/institutional`; Unusual Whales calls and Supabase writes run server-side in the Netlify `refresh-institutional-portfolios` function.
- The refresh resolves provider names from `https://phx.unusualwhales.com/api/institutions?limit=500` and `https://phx.unusualwhales.com/api/institutions?limit=500&page=1`, URL-encodes the resolved provider name, then fetches stock/fund holdings with `security_types[]=Share`, `security_types[]=Fund`, `page=0`, and `slim=true`; option holdings with `security_types[]=Option` and `slim=true`; and activity from the endpoint `page=0&limit=50&ticker=` `data` array.
- Supabase stores only latest institution info, stock/fund holdings, option holdings, and latest-quarter activity in `unusual_whales_tracked_institutions`, `unusual_whales_tracked_institution_holdings`, `unusual_whales_tracked_institution_options`, and `unusual_whales_tracked_institution_activity`; the trailing 21 quarter-end reports / 5 years of historical `total_value` and `spy_price` are stored separately in `unusual_whales_tracked_institution_history`.
- The main Institutional Holdings card table renders only the top 5 tracked institutions by latest `total_value` with Institution, Total Value, YTD Returns, Buy Value, Sell Value, and Report Period columns. YTD Returns, Buy Value, and Sell Value headers include info popovers explaining estimated 13F timing, filing delays, and inferred buy/sell value methodology. The View All action opens the full tracked-institution list. Negative Buy/Sell dollar values render as `-$22.3B`, and signed Buy/Sell values use green, red, or muted text for positive, negative, or neutral values. Return metrics are calculated from cached historical `total_value` when enough history exists; otherwise they render `—`.
- The main card shows only the top 5 tracked institutions by latest `total_value` and includes a View All link to the full list; the expanded full list includes a Back button returning to the Ownership tab without repeating the table title. Clicking an institution opens a dedicated detail page with a Back button, compact info card, YTD Returns info popover, and screens ordered Stock Holdings, Option Holdings, and Activity. Return values use cached historical `total_value`; solid dark hover tooltips compare the same period with cached `spy_price` history and show outperformance or underperformance when available. Founder(s) comes from the `people` data point, Buy/Sell values render negative dollars as `-$22.3B` with signed coloring, and Option Holdings capitalizes Type, displays `% of OI` as an unsigned neutral percentage, and highlights values above 25% in green. Empty detail states use user-facing copy without “cached” wording.

Dark Pool expanded view initially shows 15 rows and reveals 30 additional rows per View more click, matching Whale Feed pagination while preserving Dark Pool-specific data logic. Institutional Holdings list tables display full `name`, while institution detail compact titles display `short_name` with a fallback to full `name`. Detail `% of Portfolio` uses cached `perc_of_share_value * 100` as a neutral unsigned percentage. Compare-to-SPY return popups render in a foreground portal layer to avoid clipping by table/card containers. Option holdings persist `put_oi` and `call_oi` from the nested Unusual Whales `oi` object, including JSON-string `oi` payloads, so `% of OI` uses `units / put_oi` for puts and `units / call_oi` for calls. Activity ingestion reads the endpoint `data` array, safely normalizes numeric strings/nulls, allows nullable buy/sell prices and security type, and logs safe per-institution fetch, normalize, upsert, and skip counts. The Institution Detail Stock Holdings UI hides zero-unit positions and displays current position Value as `units * close` from cached holdings data, showing `—` when `close` is unavailable instead of falling back to stale report-date pricing. The Institution Detail Activity UI shows row-level activity records without aggregating duplicate tickers, excludes `Warrant` rows case-insensitively, capitalizes activity labels, colors positive activity green and negative activity red, labels the price movement column `Δ Price Since Activity`, shows signed `Change in Value` as `units_change * price_on_report` immediately after Change in Units, and sorts by largest row-level displayed value (`units * close`) with missing values last. Activity ingestion now keeps only each institution's latest available `report_date` quarter, logs latest-quarter keep/skip counts, and the Supabase cleanup migration `0024_tracked_activity_latest_quarter_cleanup.sql` removes older-quarter and Warrant activity rows from `unusual_whales_tracked_institution_activity`.

### Congressional Holdings detail views

The Ownership tab keeps the `Congressional Holdings` card name. The card shows the top 5 cached politicians by YTD return and links to a View All page with the cached top 20. Columns are Name, Chamber, Party, District, and YTD Returns; Chamber and Party are display-capitalized, profile fields come from the politician profile endpoint when available, otherwise the UI displays `—`. YTD returns treat the cached Supabase value as a decimal return and multiply by 100 for display, so `1.23` renders as `123%`; the YTD cell uses the shared Compare-to-SPY popup styling but compares against Yahoo Finance/current-market SPY YTD data, not Institutional quarterly SPY history. An info popover beside YTD Returns says exactly: “Unusual Whales estimates a politician's YTD return by tracking their disclosed holdings, applying reported trades, and comparing the portfolio's estimated value at the start of the year to its current value using current market prices. Because disclosures are delayed and reported in value ranges, the returns are estimates rather than exact results.”

Each politician row opens a Politician Detail view with a Back button, profile section, YTD return, and a grouped stock summary. The grouped table sorts by summed disclosed amount ranges across all buys and sells for each ticker and shows Ticker, Trades, Purchases, Sales, and Total Volume. Clicking a ticker opens a drilldown titled `[Politician Name]’s [Ticker] Trades` showing all cached Supabase trades for that politician/ticker by Date, Ticker, Asset, Type, and Amount, newest first.

### Economy chart refinements

The Economy tab stores FRED observations in `fred_economy`, refreshes them daily and incrementally after each series' latest saved observation date, and keeps FRED API access server-side only. Selected-card metrics use a responsive 3-column by 2-row layout on desktop/tablet, y-axis ticks are whole-number compact labels, chart domains include padding above and below the data, the y-axis label is offset with extra left margin/axis width so it does not overlap tick values, tooltips show only date and formatted value, chart titles include the selected FRED ID, the x-axis title is removed while tick labels remain, metric tiles show smaller muted units beside values, Economy info icons are removed, and detail text uses spaced `Range: start to end | Frequency: ... | ...` metadata without `Unit` or `Source: FRED`.
