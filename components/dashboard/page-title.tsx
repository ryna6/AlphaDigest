export function PageTitle({ title }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-textPrimary">{title}</h1>
    </div>
  );
}
