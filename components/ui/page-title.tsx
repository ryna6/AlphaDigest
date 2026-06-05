export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Market Intelligence Dashboard</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-primaryText">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-secondaryText">{subtitle}</p>
    </div>
  );
}
