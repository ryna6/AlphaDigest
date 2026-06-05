# Netlify Deployment

Use Netlify GitHub integration.

- Build command: `npm run build`
- Publish directory: `.next`
- Plugin: `@netlify/plugin-nextjs`

Add variables under **Site configuration → Environment variables**. A committed environment example file is not necessary because Netlify is the production source of truth and local `.env*` files are ignored by git.

Required Netlify variables:

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

Unusual Whales ingestion should scrape the public website server-side; do not configure an Unusual Whales API key or scraper feature flag. CoinGecko is treated as a no-key crypto source in this scaffold. API routes are deployed server-side by the Netlify Next.js plugin. Future scheduled jobs should live in `netlify/functions/`.
