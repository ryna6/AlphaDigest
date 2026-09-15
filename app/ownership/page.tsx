import { OwnershipView } from "@/components/dashboard/ownership/ownership-view";
import { SnapshotUnavailable } from "@/components/dashboard/snapshot-unavailable";
import { getServingDashboardSnapshot } from "@/lib/data/dashboard-serving";

export const revalidate = 1800;

export default async function OwnershipPage() {
  const result = await getServingDashboardSnapshot("ownership:latest");
  return result.ok ? (
    <OwnershipView data={result.payload} />
  ) : (
    <SnapshotUnavailable title="Ownership" />
  );
}
