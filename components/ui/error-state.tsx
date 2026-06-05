export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-xl border border-negative/40 bg-negative/10 p-4 text-sm text-negative">{message}</div>;
}
