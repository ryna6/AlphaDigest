import { Fragment } from "react";
import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { getStatusRows, STATUS_GROUPS, type StatusValue } from "@/lib/status/jobs";

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";

const statusDot: Record<StatusValue, string> = {
  Healthy: "bg-[#22c55e]",
  Warning: "bg-[#facc15]",
  Error: "bg-[#ff5a5f]",
  Unknown: "bg-[#9ca3af]"
};

const legend: Array<{ status: StatusValue; description: string }> = [
  { status: "Healthy", description: "All good" },
  { status: "Warning", description: "Degraded or delayed" },
  { status: "Error", description: "Action required" },
  { status: "Unknown", description: "No recent data" }
];

export default async function StatusPage() {
  const rows = await getStatusRows();

  return (
    <>
      <PageTitle title="Status" subtitle="Job and component health for cached dashboard data." />
      <Panel>
        <SectionHeader title="Component Status" />
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-25 gap-y-3 text-sm text-textSecondary">
          {legend.map((item) => (
            <div key={item.status} className="flex items-center gap-2 whitespace-nowrap">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDot[item.status]}`} aria-hidden="true" />
              <span className="font-medium text-textPrimary">{item.status}</span>
              <span className="ml-1 text-xs text-textSecondary">{item.description}</span>
            </div>
          ))}
        </div>
        <p className="mb-3 text-xs text-right text-textSecondary">All times are shown in Eastern Standard Time.</p>
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
