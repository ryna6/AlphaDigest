import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { getStatusRows, type StatusValue } from "@/lib/status/jobs";

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";

const statusDot: Record<StatusValue, string> = {
  Healthy: "bg-emerald-400",
  Warning: "bg-yellow-400",
  Error: "bg-red-500",
  Unknown: "bg-slate-400"
};

const legend = [
  "Healthy = All good",
  "Warning = Degraded or delayed",
  "Error = Action required",
  "Unknown = No recent data"
];

export default async function StatusPage() {
  const rows = await getStatusRows();
  const groups = Array.from(new Set(rows.map((row) => row.tab)));

  return (
    <>
      <PageTitle title="Status" subtitle="Job and component health for cached dashboard data." />
      <Panel>
        <SectionHeader title="Component Status" />
        <div className="mb-4 grid gap-2 text-sm text-textSecondary md:grid-cols-2">
          {legend.map((item) => {
            const status = item.split(" = ")[0] as StatusValue;
            return (
              <div key={item} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusDot[status]}`} aria-hidden="true" />
                <span>{item}</span>
              </div>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-borderStrong text-xs uppercase tracking-wide text-textSecondary">
              <tr>
                <th className="py-3 pr-4 font-medium">Component / Job</th>
                <th className="py-3 pr-4 font-medium">Tab / Area</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Last Run</th>
                <th className="py-3 font-medium">Next Run</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                rows
                  .filter((row) => row.tab === group)
                  .map((row) => (
                    <tr key={`${row.tab}-${row.component}-${row.id}`} className="border-b border-border/70 align-top last:border-0">
                      <td className="py-3 pr-4 text-textPrimary">
                        <div className="font-medium">{row.component}</div>
                        <div className="text-xs text-textSecondary">{row.id}</div>
                      </td>
                      <td className="py-3 pr-4 text-textSecondary">{row.tab}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-2 text-textPrimary">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusDot[row.status]}`} aria-hidden="true" />
                          {row.status}
                        </span>
                        {row.error ? <div className="mt-1 max-w-xs text-xs text-red-300">{row.error}</div> : null}
                      </td>
                      <td className="py-3 pr-4 text-textSecondary">{row.lastRun}</td>
                      <td className="py-3 text-textSecondary">{row.nextRun}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
