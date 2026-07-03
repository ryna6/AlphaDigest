export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { EconomyPlaceholderView, EconomyView } from "@/components/dashboard/economy/economy-view";

export default function EconomyPage() {
  return (
    <Suspense fallback={<EconomyPlaceholderView />}>
      <EconomyView />
    </Suspense>
  );
}
