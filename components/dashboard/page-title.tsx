export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-textPrimary">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-textSecondary">{subtitle}</p> : null}
    </div>
  );
}
