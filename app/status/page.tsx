import { Fragment } from "react";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusAutoRefresh } from "@/components/status/status-auto-refresh";
import { getStatusRowsWithDiagnostics, STATUS_GROUPS, type StatusValue } from "@/lib/status/jobs";

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const statusDot: Record<StatusValue, string> = {
  Healthy: "bg-[#22c55e]",
  Warning: "bg-[#facc15]",
  Error: "bg-[#ff5a5f]",
  Unknown: "bg-[#9ca3af]"
};


const STATUS_PAGE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Toronto"
});

function formatStatusPageDateTime(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "—";
  return STATUS_PAGE_TIME_FORMATTER.format(date).replace("a.m.", "AM").replace("p.m.", "PM");
}

const legend: Array<{ status: StatusValue; description: string }> = [
  { status: "Healthy", description: "All good" },
  { status: "Warning", description: "Degraded or delayed" },
  { status: "Error", description: "Action required" },
  { status: "Unknown", description: "No recent data" }
];

export default async function StatusPage() {
  const { rows, supabaseReadHealth } = await getStatusRowsWithDiagnostics();
  const lastUpdated = supabaseReadHealth.checkedAt;

  return (
    <>
      <StatusAutoRefresh />
      <PageTitle title="Status" subtitle="Job and component health for cached dashboard data." />
      <Panel>
        <SectionHeader title="Component Status" />
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-20 gap-y-3 text-sm text-textSecondary">
          {legend.map((item) => (
            <div key={item.status} className="flex items-center gap-2 whitespace-nowrap">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDot[item.status]}`} aria-hidden="true" />
              <span className="font-medium text-textPrimary">{item.status}</span>
              <span className="ml-1 text-xs text-textSecondary">{item.description}</span>
            </div>
          ))}
        </div>
        <div className="mb-3 text-right text-xs text-textSecondary">
          <p>Last updated: {formatStatusPageDateTime(lastUpdated)}</p>
          <p>All times are shown in Eastern Standard Time.</p>
        </div>
        {supabaseReadHealth.status === "error" ? (
          <div className="mb-4 rounded-lg border border-[#facc15]/40 bg-[#facc15]/10 px-4 py-3 text-sm text-textPrimary">
            <span className="font-semibold">Status unavailable:</span> could not read Supabase job metadata.
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="border-b border-borderStrong text-xs uppercase tracking-wide text-textSecondary">
              <tr>
                <th className="py-3 pr-4 font-medium">Job</th>
                <th className="py-3 px-4 text-center font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Source</th>
                <th className="py-3 pr-4 font-medium">Frequency</th>
                <th className="py-3 pr-4 font-medium">Last Run</th>
                <th className="py-3 font-medium">Next Run</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_GROUPS.map((group) => {
                const groupRows = rows.filter((row) => row.group === group);
                if (groupRows.length === 0) return null;

                return (
                  <Fragment key={group}>
                    <tr className="border-t border-borderStrong bg-sidebar/60 text-textPrimary first:border-t-0">
                      <td colSpan={6} className="py-3 pr-4 font-semibold">
                        {group}
                      </td>
                    </tr>
                    {groupRows.map((row) => (
                      <tr key={`${row.group}-${row.job}-${row.id}`} className="align-middle">
                        <td className="py-3 pl-6 pr-4 text-textPrimary">
                          <span className="block font-medium">{row.job}</span>
                          <span className="block text-xs text-textSecondary">{row.functionName}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center gap-2 text-textPrimary">
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDot[row.status]}`} aria-hidden="true" />
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-textSecondary">{row.source}</td>
                        <td className="py-3 pr-4 text-textSecondary">{row.frequency}</td>
                        <td className="py-3 pr-4 text-textSecondary">{row.lastRun}</td>
                        <td className="py-3 text-textSecondary">{row.nextRun}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
