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
6. Economy & Sentiment
7. Ticker Explorer

Current utility tabs:

1. Sources & Methodology
2. Settings

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
  - Put/Call Ratio from the Cboe Exchange Market Statistics section, displaying Equity, Index, and Total ratios with Eastern release time.
  - Today's Earnings count from the Unusual Whales earnings flow.
  - Today's Economic Events count from the Investing.com calendar flow.
- Featured Unusual Whales articles with title, tags, timestamp, and excerpt.
- Today's top earnings, limited to five rows.
- Today's economic events.
- Sector snapshot from the leading sector heatmap tiles.

Important behavior:

- Today shares market data with the Markets tab by calling `getMarketsPayload()`.
- Today earnings are filtered to the current ET date and ranked by `getMajorEarningsForDate()`.
- Today featured articles are separate from the News & Calendar headline feed. Do not accidentally replace one with the other.
- The Top News routes use the Today featured article payload, not the News & Calendar headline payload.

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
- Earnings rows show symbol, company, put/call ratio, and implied move.
- The News & Calendar earnings calendar uses `data.unusualWhalesEarnings` and is distinct from the compact `data.earnings` fallback rows.
- Do not couple News & Calendar earnings behavior to Today's top-five earnings panel; they share source data but have different filtering/display rules.

## Flow tab

- Page route: `app/flow/page.tsx`; API route: `/api/flow`.
- Contains Flow Summary, Dark Pool, Whale Feed, and Insider Trades.
- Flow Summary replaces Big Money Flow Summary and no longer includes Top 13F accumulation because 13F data moved to Ownership.
- Dark Pool is Supabase-backed from the provided Unusual Whales dark-pool endpoint, refreshed once daily, expected to be delayed by roughly two days, and retained for 7 days.
- Insider Trades is Supabase-backed from up to four server-side pages of the provided Unusual Whales insider endpoint, filtered to the past 6 months, aggregated by ticker, with top 5 on the main Flow tab, initial top 25 and View more up to top 50 at `/flow/insider-trades`, and detail rows at `/flow/insider-trades/[ticker]`.
- Whale Feed is Supabase-backed from the server-side Unusual Whales lit-trades whale endpoint, with fixture fallback only when cached rows are unavailable.

## Ownership tab

- Page route: `app/ownership/page.tsx`; API route: `/api/ownership`.
- Contains Institutional/13F positioning and Congressional Trades.
- Both sections remain fixture-backed placeholders until live providers/endpoints are added.

#### Flow cache behavior

The Flow tab reads cached Supabase rows/snapshots first and never calls Unusual Whales from browser components. Dark Pool keeps up to 7 days of normalized large-print rows and may show zero fresh rows when the provider is delayed, the plan returns an empty/paywalled response, filters match nothing, or the response shape changes; `/api/cache/status` and Netlify logs expose a safe `emptyReason` instead of treating unexplained zero rows as a silent success. Insider Trades are filtered to the past 6 months, deduped before Supabase upsert, and keyed with stable deterministic IDs. `flow:latest` can be written with notices when one Flow source succeeds and another fails, but refresh logs identify partial snapshots versus fully fresh snapshots.

### Flow revision details

- `/flow` now exposes View All links for Insider Trades, Dark Pool, and Whale Feed. Expanded section pages use the same Back button pattern as News pages: `/flow/insider-trades`, `/flow/dark-pool`, and `/flow/whale-feed` return to `/flow`, while ticker detail pages return to their parent section.
- The main Flow Insider Trades card uses the same full Supabase-backed 6-month row source and company aggregate helper as `/flow/insider-trades`, limited to the top 5 companies so it exactly matches the first five rows of the expanded view. The expanded Insider Trades page initially shows the top 25 and can reveal up to the top 50 with View more companies.
- Insider company aggregates include trades, purchases, sales, weighted average price, net shares, and net value. The average price is weighted by absolute shares: `sum(abs(shares) * price) / sum(abs(shares))`, skipping zero-share or missing-price rows.
- `/flow/insider-trades/[ticker]` shows individual trades and includes `shares_owned_after` as the far-right column. Aggregate company tables do not display `shares_owned_after`.
- User-facing Flow timestamps and dates are formatted in Eastern Time (`ET`) via explicit `America/New_York` formatting; Supabase storage remains UTC/timestamptz or date fields as defined by the cache tables.

### Flow follow-up fixes

- Expanded Flow pages and ticker detail pages place Back controls in the `SectionHeader` action slot, matching the same card-header location used by View All links on the main Flow cards.
- `/flow` bypasses a fresh `flow:latest` snapshot when that snapshot is marked `mock`, rebuilds from Supabase source tables first, and only uses fixture rows when source tables are unavailable or empty. This keeps main Flow Insider Trades and Dark Pool cards aligned with their expanded Supabase-backed pages.
- Insider trade transaction dates are date-only displays and do not append `ET`; Flow date-time values such as dark-pool execution timestamps still display Eastern Time with an `ET` label.

### Flow UI revision

- `/flow` keeps Flow Summary near the top, then renders Insider Trades, Dark Pool, and Whale Feed as separate full-width rows so Dark Pool and Whale Feed text has desktop room while mobile remains stacked.
- Flow Summary now uses three responsive mini cards: Insider sentiment, `Largest Dark Pool Print (7D)`, and Whale Feed. Summary cards link only when a reliable drilldown exists, such as Dark Pool ticker detail, Whale Feed expanded view, or Insider Trades expanded view, and clickable cards use the same hover-lift cursor behavior as Markets heatmap tiles.
- Dark Pool timestamps display in Eastern Time as `MM/DD HH:mm` (for example `06/15 16:00`) on the card, expanded page, and ticker detail views.
- `/flow/dark-pool/[ticker]` is ticker-level: it shows all available same-ticker dark-pool prints from the cache/source rows, sorted by most recent `executed_at` first, with the Back action returning to `/flow/dark-pool`.
- `Top insider activity` was replaced with `Insider sentiment`. Insider Sentiment uses the same full Supabase-backed 6-month insider row population as the main and expanded Insider Trades views and calculates `purchaseValue / (purchaseValue + saleValue)`, where sale value is absolute sale value. The UI labels ratios `> 0.505` Bullish, `< 0.495` Bearish, and the small documented neutral band around 0.5 Neutral, with matching color and an info tooltip.

- Flow card subtexts were cleaned up for Insider Trades, Dark Pool, and Whale Feed; technical fallback/provider notices continue to use existing mode/notices patterns.


### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify runs `refresh-whale-feed` on a conservative weekday schedule (`30 9 * * 1-5` UTC) and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page supports client-side View more in batches of 10 after the server has loaded cached rows.

Dark Pool ingestion now stores `size`, `avg30_volume`, `nbbo_bid`, `nbbo_ask`, `side`, and `sentiment` in addition to existing normalized fields. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the provider does not send a direct side, both Dark Pool and Whale Feed use a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This is only a simple buyer-/seller-leaning inference, not guaranteed trade intent.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.
