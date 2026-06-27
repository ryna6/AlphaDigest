import Link from "next/link";
import { economyMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";
import { cn } from "@/lib/utils/cn";

function MetricPanel({
  title,
  metrics,
  info
}: {
  title: string;
  metrics: typeof economyMock.rates;
  info?: string;
}) {
  return (
    <Panel>
      <SectionHeader title={title} info={info} />
      {metrics.map((m) => (
        <MetricRow key={m.label} metric={m} />
      ))}
    </Panel>
  );
}

function SentimentTabs({ active }: { active: "indicators" | "market-expectations" }) {
  const tabs = [
    { label: "Indicators", href: "/sentiment", key: "indicators" },
    { label: "Market Expectations", href: "/sentiment/market-expectations", key: "market-expectations" }
  ] as const;

  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto border-b border-borderStrong pb-2" aria-label="Sentiment sections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "shrink-0 border px-3 py-1.5 text-xs font-medium transition",
            active === tab.key
              ? "border-accentBlue/40 bg-accentBlue/10 text-textPrimary"
              : "border-borderStrong text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function EconomyView() {
  return (
    <>
      <PageTitle title="Economy" />
      <Panel>
        <SectionHeader title="Macro Regime Summary" />
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {economyMock.regimeBadges.map((m) => (
            <div key={m.label} className="rounded-none border border-borderStrong bg-sidebar p-3">
              <p className="text-xs text-textMuted">{m.label}</p>
              <p className="mt-1 text-sm font-semibold">{m.value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <MetricPanel
          title="Rates & Yield Curve"
          metrics={economyMock.rates}
          info="The yield curve compares rates across maturities; inversions often signal restrictive policy or growth concern."
        />
        <MetricPanel
          title="Inflation"
          metrics={economyMock.inflation}
          info="Core CPI excludes food and energy and is commonly watched for underlying inflation pressure."
        />
        <MetricPanel
          title="Labor Market"
          metrics={economyMock.labor}
          info="Initial jobless claims track new unemployment benefit filings and are a high-frequency labor signal."
        />
        <MetricPanel
          title="Oil & Geopolitical Risk"
          metrics={economyMock.oilRisk}
          info="WTI and Brent should come from Finnhub, Twelve Data, FRED where appropriate, or another available provider; HormuzTracker is optional with attribution."
        />
        <MetricPanel
          title="Liquidity / Fed Plumbing"
          metrics={economyMock.liquidity}
          info="Reverse repo and SOFR help monitor short-term funding and liquidity conditions."
        />
      </div>
    </>
  );
}

export function SentimentView() {
  return (
    <>
      <PageTitle title="Sentiment" />
      <SentimentTabs active="indicators" />
      <div className="grid gap-4 xl:grid-cols-2">
        <MetricPanel
          title="Sentiment & Positioning"
          metrics={economyMock.sentiment}
          info="Put/call ratios compare option put volume with call volume; high readings can indicate defensive demand."
        />
      </div>
    </>
  );
}

export function MarketExpectationsView() {
  return (
    <>
      <PageTitle title="Sentiment" />
      <SentimentTabs active="market-expectations" />
      <Panel>
        <SectionHeader title="Market Expectations" />
        <div className="rounded-none border border-dashed border-borderStrong px-4 py-8 text-center">
          <p className="text-sm font-semibold text-textPrimary">No market expectations data available yet.</p>
          <p className="mt-2 text-xs text-textMuted">
            This section will use existing cached sources when supported; no placeholder market data is shown.
          </p>
        </div>
      </Panel>
    </>
  );
}

export function EconomySentimentView() {
  return <EconomyView />;
}
