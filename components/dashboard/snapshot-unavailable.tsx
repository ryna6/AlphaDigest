import { PageTitle } from "@/components/dashboard/page-title";
import { ErrorState } from "@/components/ui/error-state";

export function SnapshotUnavailable({ title }: { title: string }) {
  return (
    <>
      <PageTitle title={title} />
      <ErrorState message="Dashboard data is temporarily unavailable. The next scheduled refresh will restore this page." />
    </>
  );
}
