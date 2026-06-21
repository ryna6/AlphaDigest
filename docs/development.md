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
COINGECKO_API_KEY=
FRED_API_KEY=
SEC_API_KEY=
SCRAPER_ENABLED=
HORMUZ_TRACKER_ENABLED=false
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
- `lib/constants/asset-icons.ts`.
- `public/assets/heatmap-icons/`.

When adding symbols:

1. Add quote symbol metadata in `quoteSymbols`.
2. Add an icon file in `public/assets/heatmap-icons/` if needed.
3. Add/update mappings in `lib/constants/asset-icons.ts`.
4. Update `docs/data-sources.md` if the symbol universe changes materially.

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
- `components/dashboard/economy-sentiment/economy-sentiment-view.tsx`
- `components/dashboard/ticker/ticker-view.tsx`
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

When testing with Supabase credentials locally or via Netlify, use `refresh-dark-pool`, `refresh-whale-feed`, `refresh-insider-trades`, and `refresh-flow`, then inspect `/api/cache/status`. The status endpoint includes Flow table counts, latest metadata for `unusual_whales_dark_pool_flows`, `unusual_whales_insider_trades`, and `flow:latest`, dark-pool `emptyReason`, dark-pool retention/window days, insider duplicate-removal counts, insider lookback months, Flow insider rows used, aggregate company counts, and snapshot freshness. Zero dark-pool rows require checking `emptyReason` and response-path diagnostics; insider duplicate counts should be removed before upsert and should not cause a Postgres `ON CONFLICT DO UPDATE command cannot affect row a second time` error.

### Flow aggregation helper notes

Use `lib/data/insider-aggregation.ts` for all insider company aggregate views and API payloads. Do not duplicate ticker aggregation in components. The helper filters to the past 6 months, sorts by trade count then absolute net value, and calculates weighted average trade price as `sum(abs(shares) * price) / sum(abs(shares))`. Use `lib/utils/time.ts` Eastern formatting helpers for user-facing Flow timestamps; do not change process timezone or Supabase storage timezone.

### Flow Summary helper

Flow Summary calculations live in `lib/data/flow-summary.ts`. The helper derives the three Flow Summary mini-card payloads and calculates Insider Sentiment as `purchaseValue / (purchaseValue + saleValue)` using the same insider trade rows as the Insider Trades card. Keep the neutral band documented in code (`> 0.505` Bullish, `< 0.495` Bearish, otherwise Neutral) and preserve fixture fallback without allowing mock data to overwrite real Supabase source rows.


### Flow Whale Feed and Dark Pool size fields

Whale Feed replaces the former Whale Trades label in the Flow UI. Netlify runs `refresh-whale-feed` on a conservative weekday schedule (`30 9 * * 1-5` UTC) and calls the Unusual Whales `lit-trades?tab=whale` endpoint server-side only; browser components never call Unusual Whales and never receive `SUPABASE_SERVICE_ROLE_KEY`. Rows are normalized into `unusual_whales_whale_feed` with only `size`, `ticker`, `price`, `nbbo_ask`, `nbbo_bid`, `executed_at`, `premium`, `sector`, `volume`, `avg30_volume`, and internal `external_id`, `side`, `sentiment`, `fetched_at`, `created_at`, `updated_at` fields. The expanded Whale Feed page supports client-side View more in batches of 10 after the server has loaded cached rows.

Dark Pool ingestion stores `size` and `avg30_volume` in addition to existing normalized fields, but does not store NBBO, side, or sentiment. Flow displays Dark Pool individual trade size from `size`; `volume` is retained as total same-day ticker volume for `% Vol = size / volume`, and `avg30_volume` powers `% 30D Vol = size / avg30_volume`.

When the Whale Feed provider does not send a direct side, Whale Feed uses a limited NBBO inference: price at or above `(nbbo_bid + nbbo_ask) / 2` is classified as ask-side/bullish, below midpoint is bid-side/bearish, and missing or invalid NBBO data is unknown. This inference is not used for Dark Pool.

Apply `supabase/manual/apply-whale-feed-dark-pool-flow.sql` in production Supabase SQL Editor before running `refresh-whale-feed`, `refresh-dark-pool`, and `refresh-flow`; the SQL is idempotent and reloads the PostgREST schema cache.

Flow Summary now labels the Whale Feed mini card as `Whale Feed (7D)` and explicitly selects the largest-premium Whale Feed row whose `executed_at` is within the past 7 days. When that summary row has a ticker, the card drills into `/flow/whale-feed/[ticker]`; otherwise it falls back to the expanded Whale Feed page only when a reliable destination exists. The Whale Feed summary subtext displays the row sentiment (`Bullish`, `Bearish`, or `Unknown`) with sentiment color, while the premium remains default text styling. The `Largest Dark Pool Print (7D)` summary subtext displays `% 30D Vol` using `size / avg30_volume` instead of sector. Whale Feed ticker detail pages show same-ticker rows sorted newest first from a fresh `flow:latest` snapshot when available, then the Supabase `unusual_whales_whale_feed` table, then fixtures only when no real rows are available. Stock/security prices use the shared full-price formatter (`$1,234.56` style) rather than compact currency, while premium/notional/market-cap values may remain compact. Supabase/serverless architecture is unchanged; browser components still do not call Unusual Whales or receive `SUPABASE_SERVICE_ROLE_KEY`.
