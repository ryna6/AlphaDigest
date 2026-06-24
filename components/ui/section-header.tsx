import { InfoTooltip } from "./info-tooltip";

export function SectionHeader({ title, subtitle, info, action }: { title: string; subtitle?: string; info?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-wide text-textPrimary">{title}</h2>
          {info ? <InfoTooltip text={info} /> : null}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-textMuted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
