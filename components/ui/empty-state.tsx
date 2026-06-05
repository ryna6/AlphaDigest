export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-none border border-dashed border-borderStrong bg-sidebar p-4 text-sm text-textMuted">
      {message}
    </div>
  );
}
