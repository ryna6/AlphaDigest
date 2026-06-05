# MarketRecap

A professional, Netlify-ready market recap dashboard that answers: **what is happening in markets today, why it matters, where money is moving, and what to look at next.**

The initial repository prioritizes a polished scaffold, typed server API routes, Netlify deployment readiness, Supabase schema design, and clearly labeled mock data. It does **not** present mock financial data as live market data.

## Tech stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Zod
- Recharts-ready chart structure
- Supabase integration scaffold
- Netlify Next.js plugin
- Future-ready Netlify Functions / Scheduled Functions

## Netlify configuration

`netlify.toml` uses:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

This is the correct Netlify shape for a Next.js App Router project because the Netlify Next.js plugin adapts App Router pages and server-side API routes for Netlify.

## Deploying to Netlify

1. Push the repository to GitHub.
2. Log in to Netlify.
3. Create a new site from Git.
4. Connect the GitHub repository.
5. Confirm the build command is `npm run build`.
6. Confirm the publish directory is `.next`.
7. Add environment variables in **Site configuration → Environment variables**.
8. Deploy the site.
9. Verify API routes such as `/api/today`, `/api/markets`, and `/api/sources/status` are working.
10. Confirm mock/live data status in the UI.
11. Check source coverage indicators on dashboard panels.
12. Review Netlify Function logs when future refresh jobs are enabled.

## Required Netlify environment variables

A committed environment example file is not required for this project because production configuration lives in Netlify **Site configuration → Environment variables** and local `.env*` files stay untracked. Configure these values directly in Netlify:

```text
NEXT_PUBLIC_APP_NAME=MarketRecap

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

FINNHUB_GLOBAL_MARKETS_API_KEY=
FINNHUB_SECTORS_HEATMAP_API_KEY=
FINNHUB_CRYPTO_HEATMAP_API_KEY=
FINNHUB_MACRO_HEATMAP_API_KEY=

TWELVE_DATA_API_KEY=
FRED_API_KEY=
SEC_API_KEY=

HORMUZ_TRACKER_ENABLED=false
```

Never expose these server-side keys to the browser: `SUPABASE_SERVICE_ROLE_KEY`, all Finnhub keys, `TWELVE_DATA_API_KEY`, `FRED_API_KEY`, and `SEC_API_KEY`.

Unusual Whales is intentionally modeled as a website-scraping source with no key or feature flag. CoinGecko is modeled as a no-key crypto source in this scaffold.

## Finnhub key strategy

Finnhub usage is split into four heatmap-specific API keys:

| Heatmap | Environment variable |
| --- | --- |
| Global Markets Heatmap | `FINNHUB_GLOBAL_MARKETS_API_KEY` |
| Sectors Heatmap | `FINNHUB_SECTORS_HEATMAP_API_KEY` |
| Crypto Heatmap fallback | `FINNHUB_CRYPTO_HEATMAP_API_KEY` |
| Macro Heatmap | `FINNHUB_MACRO_HEATMAP_API_KEY` |

`lib/data/adapters/finnhub-key-router.ts` routes feature areas to the appropriate key and returns a clear missing-key message instead of throwing.

## Oil and commodity data strategy

Oil prices are expected to come from **Finnhub, Twelve Data, FRED where appropriate, or another available/free market data provider**:

- WTI crude oil: configured server-side commodity provider chain
- Brent crude oil: configured server-side commodity provider chain
- Oil historical charts: Twelve Data if available
- Oil macro context: FRED where appropriate

See `lib/data/adapters/commodity-prices-adapter.ts` for the adapter strategy.

## API routes

All third-party integrations must run server-side. The frontend calls internal routes only:

- `/api/today`
- `/api/markets`
- `/api/news-calendar`
- `/api/flow-ownership`
- `/api/economy-sentiment`
- `/api/ticker/[symbol]`
- `/api/sources/status`

Routes return typed JSON envelopes validated with Zod and include mode, notices, and ET timezone metadata.

## Netlify Functions and future ingestion

Placeholder functions are provided in `netlify/functions/`:

- `refresh-today.ts`
- `refresh-news.ts`
- `refresh-markets.ts`
- `refresh-flow.ts`
- `refresh-economy.ts`
- `refresh-ticker.ts`
- `refresh-sources-status.ts`

Recommended future flow:

```text
External source
→ Server-side adapter / Netlify Function
→ Supabase storage
→ Dashboard snapshot
→ Next.js API route
→ Frontend
```

## What is mocked vs live

The MVP uses mock fixtures for all financial values, headlines, flow, macro, and ticker pages. Mock mode is intentionally labeled in the UI and API notices. The current live behavior is limited to reading environment-variable presence and routing key status server-side.

## Local development

Local `.env` files are optional and ignored by git. If you need local credentials, create `.env.local` manually with the same Netlify variable names above.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/overview/today`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Supabase schema

The schema proposal lives in:

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/schema.sql`

It includes raw snapshots, source runs, dashboard snapshots, normalized market data, news, calendars, flow, 13F holdings, macro, sentiment, breadth, and optional Hormuz updates.


## Disclaimer

This dashboard is for personal research and market education only. It is not financial advice, investment advice, or a recommendation to buy or sell securities. Data may be delayed, incomplete, inaccurate, or stale.
