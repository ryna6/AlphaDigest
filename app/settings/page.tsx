import { PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
const vars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "FINNHUB_GLOBAL_MARKETS_API_KEY", "FINNHUB_SECTORS_HEATMAP_API_KEY", "FINNHUB_CRYPTO_HEATMAP_API_KEY", "FINNHUB_MACRO_HEATMAP_API_KEY", "TWELVE_DATA_API_KEY", "COINGECKO_API_KEY", "FRED_API_KEY", "SEC_API_KEY", "UNUSUAL_WHALES_API_KEY"];
export default function SettingsPage() { return <><PageTitle title="Settings" subtitle="Environment, source, theme, and refresh preferences." /><Panel><SectionHeader title="Netlify Environment Variable Status" subtitle="Client page shows names only. Secret values stay server-side." /><DataTable rows={vars.map((v) => ({ Variable: v, Status: "Check /api/sources/status", Scope: v.startsWith("NEXT_PUBLIC_") ? "Client-safe" : "Server-only" }))} /></Panel></>; }
