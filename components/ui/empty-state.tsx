export function EmptyState({ message = "No data available." }: { message?: string }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-mutedText">{message}</div>;
}
