import type { SourceMeta } from "@/lib/data/schemas/common";
import { StatusBadge } from "./status-badge";

export function SourceFooter({ meta }: { meta: SourceMeta }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-[11px] text-mutedText">
      <StatusBadge status={meta.status} label={meta.mode} />
      <span>{meta.source}</span>
      <span>Last updated {meta.lastUpdated}</span>
      {meta.message ? <span className="text-warning">{meta.message}</span> : null}
    </div>
  );
}
