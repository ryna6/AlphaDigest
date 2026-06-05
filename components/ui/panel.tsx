import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-border bg-panel p-4 shadow-panel", className)}>{children}</section>;
}
