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
