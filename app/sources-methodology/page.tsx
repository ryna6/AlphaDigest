import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

const sources = [
  [
    "Unusual Whales Featured News",
    "https://unusualwhales.com/news",
    "Featured market news",
    "Today"
  ],
  [
    "Unusual Whales Broader News Feed",
    "https://unusualwhales.com/news-feed?limit=100&major_only=true",
    "Broader major news feed",
    "News & Calendar"
  ],
  [
    "Investing.com Economic Calendar",
    "https://www.investing.com/economic-calendar/",
    "Economic events",
    "Today, News & Calendar"
  ],
  [
    "Unusual Whales Earnings",
    "https://unusualwhales.com/earnings",
    "Earnings calendar",
    "Today, News & Calendar, Ticker Explorer"
  ],
  [
    "Unusual Whales Dark Pool",
    "https://unusualwhales.com/large-trades?tab=dark-pool",
    "Dark pool trades",
    "Flow & Ownership"
  ],
  [
    "Unusual Whales Whale Trades",
    "https://unusualwhales.com/large-trades?tab=whale",
    "Large whale trades",
    "Flow & Ownership"
  ],
  [
    "Unusual Whales Insider Trades",
    "https://unusualwhales.com/politics/insider_trades?search=&ticker=",
    "Insider trades",
    "Flow & Ownership"
  ],
  [
    "Capitol Trades",
    "https://www.capitoltrades.com/trades?pageSize=96",
    "Congressional trades",
    "Flow & Ownership"
  ],
  [
    "sec-api.io 13F API",
    "https://sec-api.io/docs/form-13-f-filings-institutional-holdings-api",
    "Institutional holdings",
    "Flow & Ownership"
  ],
  [
    "Finnhub Global Markets API Key",
    "https://finnhub.io/docs/api",
    "FINNHUB_GLOBAL_MARKETS_API_KEY",
    "Global Markets Heatmap"
  ],
  [
    "Finnhub Sectors Heatmap API Key",
    "https://finnhub.io/docs/api",
    "FINNHUB_SECTORS_HEATMAP_API_KEY",
    "Sectors Heatmap"
  ],
  [
    "Finnhub Crypto Heatmap API Key",
    "https://finnhub.io/docs/api",
    "FINNHUB_CRYPTO_HEATMAP_API_KEY",
    "Crypto fallback"
  ],
  [
    "Finnhub Macro Heatmap API Key",
    "https://finnhub.io/docs/api",
    "FINNHUB_MACRO_HEATMAP_API_KEY",
    "Macro Heatmap"
  ],
  [
    "Twelve Data API",
    "https://twelvedata.com/docs",
    "OHLC, charts, commodities",
    "Today, Markets, Ticker Explorer"
  ],
  [
    "CoinGecko No-Key Crypto Source",
    "https://docs.coingecko.com/",
    "Crypto prices",
    "Today, Markets"
  ],
  [
    "FRED API",
    "https://fred.stlouisfed.org/docs/api/fred/",
    "Macro data, rates, spreads, oil context",
    "Economy & Sentiment"
  ],
  [
    "CBOE Market Statistics",
    "https://www.cboe.com/data/mktstat.aspx?dt=2026-06-04",
    "Put/call ratios",
    "Today, Economy & Sentiment"
  ],
  [
    "AAII Sentiment Survey",
    "https://www.aaii.com/sentimentsurvey/sent_results",
    "Bullish/neutral/bearish sentiment",
    "Economy & Sentiment"
  ],
  [
    "HormuzTracker",
    "https://www.hormuztracker.com/",
    "Optional Strait of Hormuz risk",
    "Economy & Sentiment"
  ],
  [
    "HormuzTracker Methodology",
    "https://www.hormuztracker.com/methodology",
    "Attribution and methodology",
    "Sources & Methodology"
  ]
];

const definitions = [
  "Put/call ratio",
  "VIX3M/VIX ratio",
  "Market breadth",
  "Dark pool",
  "Whale trade",
  "13F filing",
  "Congressional disclosure delay",
  "Credit spread",
  "Yield curve",
  "Initial jobless claims",
  "Core CPI",
  "PPI",
  "Reverse repo",
  "SOFR",
  "VIX"
];

export default function SourcesMethodologyPage() {
  return (
    <>
      <PageTitle title="Sources & Methodology" />
      <Panel>
        <SectionHeader title="Data Sources" />
        <DataTable
          rows={sources.map(([Source, Link, Provides, UsedIn]) => ({
            Source,
            Link,
            Provides,
            UsedIn
          }))}
        />
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Refresh Schedule" />
        <p className="text-sm leading-6 text-textSecondary">
          News should refresh every 5–15 minutes, flow every 15–60 minutes depending on limits, FRED
          macro daily, CBOE after market close, AAII weekly, and Finnhub heatmaps every 1–15 minutes
          while respecting rate limits. All market display logic uses America/New_York and shows ET
          timestamps.
        </p>
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Metric Definitions" />
        <div className="grid gap-2 md:grid-cols-3">
          {definitions.map((d) => (
            <div
              key={d}
              className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textSecondary"
            >
              <strong className="text-textPrimary">{d}:</strong> concise tooltip-ready definition
              planned for production copy.
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Netlify Deployment & Data Pipeline" />
        <p className="text-sm leading-6 text-textSecondary">
          External sources feed server-side adapters, scraper jobs, or Netlify Scheduled Functions,
          then Supabase raw snapshots and normalized tables, then dashboard snapshots, then internal
          Next.js API routes consumed by the frontend. The browser never receives secret API keys.
        </p>
      </Panel>
      <Panel className="mt-4">
        <SectionHeader title="Disclaimer" />
        <p className="text-sm leading-6 text-warning">
          This dashboard is for personal research and market education only. It is not financial
          advice, investment advice, or a recommendation to buy or sell securities. Data may be
          delayed, incomplete, inaccurate, or stale.
        </p>
      </Panel>
    </>
  );
}
