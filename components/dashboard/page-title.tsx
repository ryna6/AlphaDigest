import { StatusBadge } from "@/components/ui/status-badge";

export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-textPrimary">{title}</h1><p className="mt-1 text-sm text-textMuted">{subtitle}</p></div><div className="flex gap-2"><StatusBadge status="mock" /><StatusBadge status="degraded" /></div></div>;
}
