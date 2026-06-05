export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-primaryText">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-mutedText">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
