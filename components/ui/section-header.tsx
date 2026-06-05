import type { ReactNode } from "react";

export function SectionHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mutedText">{eyebrow}</p> : null}
        <h2 className="text-sm font-semibold text-primaryText">{title}</h2>
      </div>
      {action}
    </div>
  );
}
