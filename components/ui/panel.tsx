import { cn } from "@/lib/utils/cn";

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-border bg-panel p-4 shadow-panel", className)}>{children}</section>;
}
