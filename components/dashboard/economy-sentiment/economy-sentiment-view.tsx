import { economyMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";

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
export function EconomySentimentView() {
  return (
    <>
      <PageTitle
        title="Economy & Sentiment"
        subtitle="Is the broader backdrop supportive or risky."
      />
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
          title="Sentiment & Positioning"
          metrics={economyMock.sentiment}
          info="Put/call ratios compare option put volume with call volume; high readings can indicate defensive demand."
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
