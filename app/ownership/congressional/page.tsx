import { PageTitle } from "@/components/dashboard/page-title";
import { CongressionalHoldingsCard } from "@/components/dashboard/ownership/congressional-holdings-card";
import { Panel } from "@/components/ui/panel";

export default function CongressionalListPage() {
  return <><PageTitle title="Congressional Holdings" subtitle="Top 20 politicians by cached YTD returns." /><Panel><CongressionalHoldingsCard mode="list" /></Panel></>;
}
