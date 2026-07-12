"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
export function NavigationProgress() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  useEffect(() => { setPendingHref(null); }, [pathname]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      if (!href || href.startsWith("http") || href === pathname) return;
      startTransition(() => setPendingHref(href));
      window.setTimeout(() => setPendingHref((current) => current === href ? null : current), 10000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, startTransition]);
  if (!pendingHref) return null;
  return <div className="pointer-events-none sticky top-0 z-50 h-1 w-full" aria-live="polite" aria-busy="true" role="status"><span className="sr-only">Loading navigation target</span><div className="h-full w-2/3 bg-accentBlue motion-safe:animate-pulse" /></div>;
}
