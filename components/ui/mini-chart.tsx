export function MiniChart({ label = "Chart placeholder" }: { label?: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-sidebar/50 text-xs text-mutedText">
      {label} · live OHLC adapter pending
    </div>
  );
}
