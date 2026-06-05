import type { SourceMeta } from "@/lib/data/schemas/common";
import { StatusBadge } from "./status-badge";

export function SourceFooter({ meta }: { meta: SourceMeta[] }) {
  return <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-textMuted">{meta.map((item) => <span key={`${item.source}-${item.lastUpdated}`} className="inline-flex items-center gap-2 rounded-full border border-borderStrong bg-sidebar px-2 py-1"><StatusBadge status={item.status} /> {item.source} • {item.mode}</span>)}</div>;
}
