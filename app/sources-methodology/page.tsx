import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

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
    </>
  );
}
