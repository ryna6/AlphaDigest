import { PageTitle } from "@/components/dashboard/page-title";
import { DataTable } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";

const vars = [
  "NEXT_PUBLIC_APP_NAME",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FINNHUB_GLOBAL_MARKETS_API_KEY",
  "FINNHUB_SECTORS_HEATMAP_API_KEY",
  "FINNHUB_CRYPTO_HEATMAP_API_KEY",
  "FINNHUB_MACRO_HEATMAP_API_KEY",
  "TWELVE_DATA_API_KEY",
  "COINGECKO_API_KEY",
  "FRED_API_KEY",
  "SEC_API_KEY",
  "SCRAPER_ENABLED",
  "HORMUZ_TRACKER_ENABLED"
];

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Settings" subtitle="Environment, source, theme, and refresh preferences." />
      <Panel>
        <SectionHeader
          title="Netlify Environment Variable Status"
          subtitle="Client page shows names only. Secret values stay server-side. Optional provider keys are checked by internal API routes and Netlify functions."
        />
        <DataTable
          rows={vars.map((v) => ({
            Variable: v,
            Status: "Check /api/sources/status",
            Scope: v.startsWith("NEXT_PUBLIC_") ? "Client-safe" : "Server-only"
          }))}
        />
      </Panel>
    </>
  );
}
