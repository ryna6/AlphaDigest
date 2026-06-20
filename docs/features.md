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
5. Economy & Sentiment
6. Ticker Explorer

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
- Contains Flow Summary, Dark Pool, Whale Trades, and Insider Trades.
- Flow Summary replaces Big Money Flow Summary and no longer includes Top 13F accumulation because 13F data moved to Ownership.
- Dark Pool is Supabase-backed from the provided Unusual Whales dark-pool endpoint, refreshed once daily, expected to be delayed by roughly two days, and retained for 7 days.
- Insider Trades is Supabase-backed from the provided Unusual Whales insider endpoint, filtered to the past 3 months, aggregated by ticker, with top 5 on the main Flow tab, top 25 at `/flow/insider-trades`, and detail rows at `/flow/insider-trades/[ticker]`.
- Whale Trades remains fixture-backed because no live endpoint was provided.

## Ownership tab

- Page route: `app/ownership/page.tsx`; API route: `/api/ownership`.
- Contains Institutional/13F positioning and Congressional Trades.
- Both sections remain fixture-backed placeholders until live providers/endpoints are added.
