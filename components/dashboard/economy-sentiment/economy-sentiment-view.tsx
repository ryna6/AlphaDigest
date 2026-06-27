import { economyMainCards, economySummaryCards, type EconomyCardDefinition } from "@/lib/data/economy-config";
import { economyMock } from "@/lib/data/fixtures/mock-dashboard";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricRow } from "@/components/ui/metric-row";

function PendingMetricList({ card }: { card: EconomyCardDefinition }) {
  if (!card.metrics.length) {
    return (
      <div className="rounded-none border border-dashed border-borderStrong bg-sidebar/70 p-3">
        <p className="text-xs font-semibold text-textSecondary">Derived signal</p>
        <p className="mt-1 text-xs text-textMuted">
          Inputs pending: {card.derivedFrom?.join(", ") ?? "Awaiting data source"}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {card.metrics.map((metric) => (
        <div key={metric.id} className="rounded-none border border-borderStrong bg-sidebar p-3">
          <p className="text-xs text-textMuted">{metric.label}</p>
          <p className="mt-1 text-sm font-semibold text-textPrimary">Awaiting data source</p>
        </div>
      ))}
    </div>
  );
}

function EconomyScaffoldCard({ card, compact = false }: { card: EconomyCardDefinition; compact?: boolean }) {
  return (
    <Panel>
      <SectionHeader title={card.title} info={card.description} />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-borderStrong bg-sidebar px-3 py-1 text-xs font-semibold text-textSecondary">
            {card.statusLabel}
          </span>
          <span className="text-xs text-textMuted">No live data connected</span>
        </div>
        <PendingMetricList card={card} />
        {!compact && card.hasMiniChart ? (
          <div className="rounded-none border border-dashed border-borderStrong bg-sidebar/50 px-4 py-6 text-center text-xs text-textMuted">
            Mini-chart pending confirmed series mapping.
          </div>
        ) : null}
        <p className="text-sm text-textSecondary">{card.interpretation}</p>
      </div>
    </Panel>
  );
}

function MetricPanel({
  title,
  metrics,
  info
}: {
  title: string;
  metrics: typeof economyMock.sentiment;
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

function SentimentSummaryRow() {
  const summaryCards = economyMock.sentiment.slice(0, 3);

  return (
    <Panel>
      <SectionHeader title="Sentiment Summary" />
      <div className="grid gap-2 md:grid-cols-3">
        {summaryCards.length ? (
          summaryCards.map((m) => (
            <div key={m.label} className="rounded-none border border-borderStrong bg-sidebar p-3">
              <p className="text-xs text-textMuted">{m.label}</p>
              <p className="mt-1 text-sm font-semibold text-textPrimary">{m.value}</p>
              {m.change || m.changePercent ? (
                <p className="mt-1 text-xs text-textSecondary">{m.change ?? m.changePercent}</p>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-none border border-dashed border-borderStrong bg-sidebar p-3 md:col-span-3">
            <p className="text-sm font-semibold text-textPrimary">Sentiment summary unavailable.</p>
            <p className="mt-1 text-xs text-textMuted">Existing cached sentiment sources have not provided summary data yet.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function EconomyView() {
  return (
    <>
      <PageTitle title="Economy" />
      <div className="grid gap-4 md:grid-cols-3">
        {economySummaryCards.map((card) => (
          <EconomyScaffoldCard key={card.id} card={card} compact />
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {economyMainCards.map((card) => (
          <EconomyScaffoldCard key={card.id} card={card} />
        ))}
      </div>
    </>
  );
}

export function SentimentView() {
  return (
    <>
      <PageTitle title="Sentiment" />
      <SentimentSummaryRow />
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
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
