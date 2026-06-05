import { cn } from "@/lib/utils/cn";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-borderStrong bg-panel p-4 shadow-panel", className)}>{children}</section>;
}
