import type { SourceMeta } from "@/lib/types";
import { StatusBadge } from "./status-badge";

export function SourceFooter({ meta }: { meta: SourceMeta }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-[11px] text-mutedText">
      <StatusBadge status={meta.status} label={meta.mode === "mock" ? "mock" : meta.status} />
      <span>{meta.source}</span>
      <span>Updated {meta.lastUpdated}</span>
      {meta.message ? <span className="text-warning">{meta.message}</span> : null}
    </div>
  );
}
