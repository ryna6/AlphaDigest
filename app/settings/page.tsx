import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";

export default function SettingsPage() {
  const keys = getFinnhubKeyStatus();
  return <><PageTitle title="Settings" subtitle="Source preferences, theme settings, refresh behavior, and Netlify environment variable status placeholders." /><div className="grid gap-4 xl:grid-cols-2"><Panel><SectionHeader title="Netlify Environment Status" /><p className="text-sm text-secondaryText">API key missing. Add required variables in Netlify Site configuration → Environment variables.</p><div className="mt-3 space-y-2">{keys.map((key) => <div key={key.envName} className="flex items-center justify-between rounded-xl border border-border bg-sidebar p-3 text-xs"><span>{key.envName}</span><StatusBadge status={key.status as "fresh" | "unavailable"} /></div>)}</div></Panel><Panel><SectionHeader title="Preferences" /><div className="space-y-3 text-sm text-secondaryText"><p>Theme: Dark terminal style</p><p>Market timezone: America/New_York</p><p>Mock mode fallback: Enabled until API keys and scheduled ingestion are configured</p><p>Scraper enabled: server-side flag only</p></div></Panel></div></>;
}
