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
4. Flow & Ownership
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

## Flow & Ownership tab

Route/component/data:

- Page route: `app/flow-ownership/page.tsx`.
- View component: `components/dashboard/flow-ownership/flow-ownership-view.tsx`.
- Data fixture: `flowMock` in `lib/data/fixtures/mock-dashboard.ts`.
- API route: `/api/flow-ownership` also returns `flowMock`.

The page currently displays fixture-backed tables for:

- Big Money Flow Summary.
- Dark Pool.
- Whale Trades.
- Insider Trades.
- Congressional Trades.
- Institutional Positioning.

Do not claim this page has live Unusual Whales, Capitol Trades, or SEC API ingestion until those flows are implemented and wired into the page/API.

## Economy & Sentiment tab

Route/component/data:

- Page route: `app/economy-sentiment/page.tsx`.
- View component: `components/dashboard/economy-sentiment/economy-sentiment-view.tsx`.
- Data fixture: `economyMock`.
- API route: `/api/economy-sentiment` also returns `economyMock`.

The page currently displays fixture-backed panels for:

- Macro Regime Summary.
- Rates & Yield Curve.
- Inflation.
- Labor Market.
- Sentiment & Positioning.
- Oil & Geopolitical Risk.
- Liquidity / Fed Plumbing.

Do not document FRED, CBOE, AAII, or HormuzTracker data as active here until code fetches those sources and page/API wiring uses them.

## Ticker Explorer

Route/component/data:

- Search page: `app/ticker-explorer/page.tsx`.
- Detail page: `app/ticker/[symbol]/page.tsx`.
- Component: `components/dashboard/ticker/ticker-view.tsx`.
- API route: `/api/ticker/[symbol]` returns `tickerMock(symbol)`.

Current behavior:

- The explorer page is a placeholder panel and does not perform live browser lookup.
- Direct detail routes such as `/ticker/NVDA` are fixture-backed.
- Detail pages show ticker story, header metrics, catalyst timeline, flow/ownership context, and sector context.

## Sources & Methodology

Route: `app/sources-methodology/page.tsx`.

The page is a static source reference table. It lists current and intended sources. Because some listed sources are not wired into live page flows, keep wording conservative in user docs and technical docs.

## Settings

Route: `app/settings/page.tsx`.

The page lists environment variable names and labels each as client-safe or server-only. It does not read secret values in the browser. For actual configured/missing status, use `/api/sources/status`.

## Shared UI components

- `Panel`: section container.
- `SectionHeader`: title/subtitle/info/action header.
- `MetricRow`: row for metric label/value/change.
- `DataTable`: generic table for object rows.
- `Heatmap`: treemap-like tile grid for market heatmaps.
- `InfoTooltip`: hover/focus explanatory tooltip.
- `ErrorState` and `EmptyState`: reusable states.
- `MiniChart`: mock SVG trend chart.

## Mobile and responsive behavior

- Most page content stacks by default and switches to multi-column layouts at `md`, `lg`, or `xl` breakpoints.
- The desktop sidebar remains sticky while scrolling and is hidden below `lg`; mobile uses a sticky, horizontally scrollable primary-tab bar instead of a drawer.
- Tables use compact text and horizontal constraints but are not universally optimized for very narrow screens.
- Before changing layouts, verify Today, Markets, and News & Calendar because they are the densest pages.

## Faster tab switching with cached snapshots

Today, Markets, and News & Calendar now prefer frontend-ready Supabase dashboard snapshots. When scheduled refreshes are healthy, switching tabs reads compact cached payloads instead of waiting for every external provider. If snapshots are stale or unavailable, the existing live/fallback behavior still renders the same UI shape.

### Cache fallback behavior

If a fresh dashboard snapshot exists, Today, Markets, and News & Calendar return it without external provider calls. If the snapshot is stale or missing, the server uses existing live/fallback builders and attempts to write a fresh snapshot; if live fallback throws and a stale snapshot exists, the stale payload is returned with a notice instead of a blank page.

### Snapshot-first dashboard loading

Today, Markets, and News & Calendar use fresh Supabase `dashboard_snapshots` before external provider calls. If a fresh snapshot exists, tab APIs return the cached payload quickly. If no fresh snapshot exists, server-side live/fallback behavior remains available; stale snapshots are used only as a safety net when live fallback fails. Cache health and missing schema issues are visible at `/api/cache/status`.
