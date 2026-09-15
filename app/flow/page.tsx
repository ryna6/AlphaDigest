import { FlowView } from "@/components/dashboard/flow/flow-view";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";

export const revalidate = 600;

export default async function FlowPage() {
  const result = await getServingDashboardSnapshot("flow:latest");
  return result.ok ? <FlowView data={result.payload} /> : <SnapshotUnavailable title="Flow" />;
}
