import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";

const sources = [
  { source: "Unusual Whales Featured News", link: "https://unusualwhales.com/news", provides: "Featured market news", used: "Today" },
  { source: "Unusual Whales Broader News Feed", link: "https://unusualwhales.com/news-feed?limit=100&major_only=true", provides: "Major news feed", used: "News & Calendar" },
  { source: "Unusual Whales Economic Calendar", link: "https://unusualwhales.com/economic-calendar", provides: "Economic events", used: "Today, News & Calendar" },
  { source: "Unusual Whales Earnings", link: "https://unusualwhales.com/earnings", provides: "Earnings calendar", used: "Today, News & Calendar, Ticker" },
  { source: "Unusual Whales Dark Pool", link: "https://unusualwhales.com/large-trades?tab=dark-pool", provides: "Dark pool trades", used: "Flow & Ownership" },
  { source: "Unusual Whales Whale Trades", link: "https://unusualwhales.com/large-trades?tab=whale", provides: "Large whale trades", used: "Flow & Ownership" },
  { source: "Capitol Trades", link: "https://www.capitoltrades.com/trades?pageSize=96", provides: "Congressional trades", used: "Flow & Ownership" },
  { source: "sec-api.io 13F API", link: "https://sec-api.io/docs/form-13-f-filings-institutional-holdings-api", provides: "Institutional holdings", used: "Flow, Ticker" },
  { source: "Finnhub heatmap keys", link: "https://finnhub.io/docs/api", provides: "Quotes and market data", used: "Markets" },
  { source: "Twelve Data", link: "https://twelvedata.com/docs", provides: "OHLC and commodities", used: "Charts, oil, metals" },
  { source: "CoinGecko", link: "https://docs.coingecko.com/", provides: "Crypto market data", used: "Today, Markets" },
  { source: "FRED", link: "https://fred.stlouisfed.org/docs/api/fred/", provides: "Macro observations", used: "Economy & Sentiment" },
  { source: "CBOE Market Statistics", link: "https://www.cboe.com/data/mktstat.aspx?dt=2026-06-04", provides: "Put/call ratios", used: "Today, Economy" },
  { source: "AAII Sentiment Survey", link: "https://www.aaii.com/sentimentsurvey/sent_results", provides: "Investor sentiment", used: "Economy" },
  { source: "HormuzTracker", link: "https://www.hormuztracker.com/", provides: "Optional Strait of Hormuz status", used: "Oil risk" }
];
const definitions = ["Put/call ratio", "VIX3M/VIX ratio", "Market breadth", "Dark pool", "Whale trade", "13F filing", "Congressional disclosure delay", "Credit spread", "Yield curve", "Initial jobless claims", "Core CPI", "PPI", "Reverse repo", "SOFR", "VIX"];
export default function SourcesMethodologyPage() {
  return <><PageTitle title="Sources & Methodology" subtitle="How data sources, freshness states, refresh schedules, Netlify deployment, and metric definitions are handled." /><Panel><SectionHeader title="Data Sources" /><DataTable columns={[{ key: "source", header: "Source" }, { key: "link", header: "Link" }, { key: "provides", header: "Provides" }, { key: "used", header: "Used in" }]} rows={sources} /></Panel><div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionHeader title="Refresh Schedule" /><ul className="space-y-2 text-sm text-secondaryText"><li>Financial news: 5–15 min if possible.</li><li>Heatmaps: 1–15 min depending on source limits.</li><li>FRED macro: every 24 hr.</li><li>CBOE put/call: daily around market close.</li><li>AAII sentiment: weekly Thursday.</li><li>13F holdings: daily or weekly check, quarterly data.</li></ul></Panel><Panel><SectionHeader title="Metric Definitions" /><div className="flex flex-wrap gap-2">{definitions.map((term) => <span key={term} className="rounded-full border border-border bg-sidebar px-3 py-1 text-xs text-secondaryText">{term}</span>)}</div></Panel><Panel><SectionHeader title="Freshness Definitions" /><p className="text-sm leading-6 text-secondaryText">Fresh means inside threshold. Delayed means source cadence is expectedly delayed. Stale means last good run exceeded threshold. Degraded means failures are occurring while cached data may remain. Unavailable means source or key is missing.</p></Panel><Panel><SectionHeader title="Disclaimer" /><p className="text-sm leading-6 text-warning">This dashboard is for personal research and market education only. It is not financial advice, investment advice, or a recommendation to buy or sell securities. Data may be delayed, incomplete, inaccurate, or stale.</p></Panel></div></>;
}
