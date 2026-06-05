# Market Intelligence Dashboard

A professional, Netlify-ready market analytics dashboard scaffold built with Next.js App Router, TypeScript, Tailwind CSS, server-side API routes, source freshness tracking, Supabase schema planning, and future Netlify ingestion functions.

> This dashboard is for personal research and market education only. It is not financial advice, investment advice, or a recommendation to buy or sell securities. Data may be delayed, incomplete, inaccurate, or stale.

## Tech stack

- Next.js App Router + React + TypeScript
- Tailwind CSS dark financial-terminal UI
- Zod API payload validation
- Recharts for initial chart placeholders
- Supabase schema proposal
- Netlify deployment with `@netlify/plugin-nextjs`
- Future Netlify Functions / Scheduled Functions

## What is mocked vs live

The initial scaffold intentionally uses clearly labeled mock data. API routes are server-side and ready to be connected to live adapters, but no third-party API is called from the browser and no real key is included.

Live integrations should start with CoinGecko, FRED, Finnhub heatmap-specific quote adapters, and Twelve Data. Scraped or fragile sources should remain server-side and disabled unless explicitly configured.

## Netlify configuration

`netlify.toml` uses the modern Netlify Next.js plugin configuration:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Next.js API routes under `app/api/**/route.ts` are handled server-side by Netlify's Next.js runtime.

## Deploying to Netlify

1. Push this repository to GitHub.
2. Log in to Netlify.
3. Create a new site from Git.
4. Connect the GitHub repository.
5. Confirm the build command is `npm run build`.
6. Confirm the publish directory is `.next`.
7. Add environment variables in Netlify under **Site configuration → Environment variables**.
8. Deploy the site.
9. Verify API routes such as `/api/today`, `/api/markets`, and `/api/sources/status`.
10. Confirm mock/live data status banners are visible.
11. Check source freshness indicators on dashboard panels.
12. Review Netlify Function logs when future ingestion functions are enabled.

## Required environment variables

Copy `.env.example` for local development and configure the same values in Netlify:

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

Never expose server-side keys with `NEXT_PUBLIC_`. Only `NEXT_PUBLIC_APP_NAME` is client-safe.

## Finnhub heatmap key strategy

Finnhub usage is split across four feature-specific keys:

| Heatmap | Environment variable |
| --- | --- |
| Global Markets Heatmap | `FINNHUB_GLOBAL_MARKETS_API_KEY` |
| Sectors Heatmap | `FINNHUB_SECTORS_HEATMAP_API_KEY` |
| Crypto Heatmap fallback | `FINNHUB_CRYPTO_HEATMAP_API_KEY` |
| Macro Heatmap | `FINNHUB_MACRO_HEATMAP_API_KEY` |

The router in `lib/data/adapters/finnhub-key-router.ts` maps feature areas to keys and returns a UI-safe missing-key message instead of throwing.

## Oil and commodity data strategy

WTI crude oil, Brent crude oil, oil historical charts, gold, and silver are expected to come from Finnhub, Twelve Data, FRED where appropriate, or another available/free market data provider. The scaffold includes `commodity-prices-adapter.ts` to document provider preference and keep future live implementations server-side.

## Local development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

Local development is secondary; Netlify deployment is the production target.

## API routes

- `/api/today`
- `/api/markets`
- `/api/news-calendar`
- `/api/flow-ownership`
- `/api/economy-sentiment`
- `/api/ticker/[symbol]`
- `/api/sources/status`

Routes read server-side environment variables, return typed JSON payloads, keep secrets hidden, and gracefully report missing keys.

## Future ingestion flow

```text
External source
→ Server-side adapter / Netlify Function
→ Supabase storage
→ Dashboard snapshot
→ Next.js API route
→ Frontend
```

Placeholder functions live in `netlify/functions/` for future scheduled ingestion jobs.
