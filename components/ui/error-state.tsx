export function ErrorState({ message = "Source currently degraded. Showing cached data if available." }: { message?: string }) {
  return <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">{message}</div>;
}
