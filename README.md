# Market Intelligence Dashboard

A professional, desktop-first, Netlify-ready market analytics dashboard scaffold inspired by the disciplined dark, compact, data-forward feel of financial terminals. This is an original implementation and does not copy RankAlpha.

> **MVP status:** The UI, routes, API contracts, Netlify configuration, source architecture, and Supabase schema are implemented. Financial values are mock fixtures and are labeled as mock/degraded until live adapters and Netlify environment variables are configured.

## Tech stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Zod
- Supabase schema draft
- Netlify + `@netlify/plugin-nextjs`
- Future-ready Netlify Functions
- Recharts/TanStack dependencies for later richer charts and tables

## Architecture

```text
External source
→ Server-side adapter / Netlify Function
→ Supabase raw snapshot storage
→ Normalized tables
→ Dashboard snapshots
→ Next.js API routes
→ Frontend dashboard
```

The frontend calls internal API routes only. Third-party API keys remain server-side.

## Netlify deployment configuration

`netlify.toml` uses:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

This is the modern Netlify setup for deploying a Next.js App Router project. The plugin handles Next pages and API routes as Netlify-compatible server-side functions.

## Environment variables

Create these in Netlify under **Site configuration → Environment variables**. Do not expose secret keys with `NEXT_PUBLIC_`.

```text
NEXT_PUBLIC_APP_NAME=Market Intelligence Dashboard

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

UNUSUAL_WHALES_API_KEY=
SCRAPER_ENABLED=false
HORMUZ_TRACKER_ENABLED=false
```

Never expose these in the browser: Supabase service role, Finnhub keys, Twelve Data, CoinGecko, FRED, SEC API, and Unusual Whales keys.

## Finnhub key strategy

Finnhub usage is intentionally split into four feature-specific keys to reduce rate-limit pressure:

| Heatmap | Environment variable |
| --- | --- |
| Global Markets Heatmap | `FINNHUB_GLOBAL_MARKETS_API_KEY` |
| Sectors Heatmap | `FINNHUB_SECTORS_HEATMAP_API_KEY` |
| Crypto Heatmap fallback | `FINNHUB_CRYPTO_HEATMAP_API_KEY` |
| Macro Heatmap | `FINNHUB_MACRO_HEATMAP_API_KEY` |

The helper `lib/data/adapters/finnhub-key-router.ts` maps feature areas to keys and returns a structured missing-key message instead of throwing.

## Oil and commodity data

WTI crude oil, Brent crude oil, oil historical charts, gold, and silver are designed to use Finnhub, Twelve Data, FRED where appropriate, or another available/free market data provider. FRED is especially useful for macro context and official series; Twelve Data is preferred for historical chart candles when available.

## API routes

- `/api/today`
- `/api/markets`
- `/api/news-calendar`
- `/api/flow-ownership`
- `/api/economy-sentiment`
- `/api/ticker/[symbol]`
- `/api/sources/status`

All routes return typed JSON, use server-side environment access, and currently return clearly labeled mock data.

## Deploying to Netlify

1. Push this repository to GitHub.
2. Log in to Netlify.
3. Create a new site from Git.
4. Connect the GitHub repository.
5. Confirm the build command: `npm run build`.
6. Confirm the publish directory: `.next`.
7. Add environment variables in **Site configuration → Environment variables**.
8. Deploy the site.
9. Verify API routes are working, such as `/api/sources/status`.
10. Confirm mock/live data status in the top bar and source footers.
11. Check source freshness indicators on panels.
12. Review Netlify Function logs when future scheduled refresh functions are implemented.

## Local development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

Local development is supported, but Netlify deployment is the intended production path.

## Future Netlify Functions

Placeholders are in `netlify/functions/`:

- `refresh-today.ts`
- `refresh-news.ts`
- `refresh-markets.ts`
- `refresh-flow.ts`
- `refresh-economy.ts`
- `refresh-ticker.ts`
- `refresh-sources-status.ts`

Future functions should fetch sources server-side, store raw snapshots, normalize rows into Supabase, and update dashboard snapshots.

## What is mocked vs live

Mocked in MVP:

- Market prices and heatmap values
- Featured and broader news rows
- Earnings and economic calendar rows
- Dark pool, whale, insider, congressional, and 13F rows
- Macro, sentiment, oil, and liquidity values
- Ticker explorer details

Live-ready architecture in MVP:

- Server-side API routes
- Environment variable status reporting
- Finnhub feature-key routing
- Commodity provider strategy
- Supabase schema and snapshot tables
- Netlify Functions placeholders

## Known limitations

- No live third-party integrations are enabled yet.
- No Supabase client writes are performed yet.
- Future scraping adapters must respect source terms, use feature flags, and capture source health.
- Netlify scheduled function cadence should be tuned to plan limits.

## Disclaimer

This dashboard is for personal research and market education only. It is not financial advice, investment advice, or a recommendation to buy or sell securities. Data may be delayed, incomplete, inaccurate, or stale.
