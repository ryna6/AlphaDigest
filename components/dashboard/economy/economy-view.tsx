import { PageTitle } from "@/components/dashboard/page-title";
import { EconomyCardGrid } from "./economy-card-grid";
import type { EconomyPayload } from "@/lib/data/schemas/dashboard";

export function EconomyView({ payload }: { payload: EconomyPayload }) {
  return (
    <>
      <PageTitle title="Economy" />
      <EconomyCardGrid summaryCards={payload.summaryCards} mainCards={payload.mainCards} loading={false} error={null} />
    </>
  );
}
