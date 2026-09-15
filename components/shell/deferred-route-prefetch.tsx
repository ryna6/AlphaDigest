"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { mainNavigation, utilityNavigation } from "@/lib/constants/navigation";

const priority = ["/markets", "/news-calendar", "/flow", "/ownership", "/sentiment", "/status"];
const slowTypes = new Set(["slow-2g", "2g"]);

type ConnectionLike = { saveData?: boolean; effectiveType?: string };
export function canBackgroundPrefetch({ connection, visibilityState }: { connection?: ConnectionLike; visibilityState?: DocumentVisibilityState | "visible" | "hidden" }) {
  if (visibilityState && visibilityState !== "visible") return false;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && slowTypes.has(connection.effectiveType)) return false;
  return true;
}
export function orderedPrefetchRoutes(currentPathname: string) {
  const valid = new Set([...mainNavigation, ...utilityNavigation].map((item) => item.href));
  return priority.filter((href) => valid.has(href) && href !== currentPathname && !currentPathname.startsWith(`${href}/`));
}

function idle(cb: () => void, timeout = 2500) {
  if (typeof window === "undefined") return 0;
  const ric = window.requestIdleCallback;
  if (ric) return ric(cb, { timeout }) as unknown as number;
  return window.setTimeout(cb, 600);
}
function cancelIdle(id: number) {
  if (typeof window === "undefined") return;
  if (window.cancelIdleCallback) window.cancelIdleCallback(id as unknown as number);
  else window.clearTimeout(id);
}

export function DeferredRoutePrefetch() {
  const router = useRouter();
  const pathname = usePathname();
  const prefetched = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const active = useRef<string | null>(null);
  const cancelled = useRef(false);
  const routes = useMemo(() => orderedPrefetchRoutes(pathname), [pathname]);

  const prefetchOne = useCallback((href: string) => {
    if (prefetched.current.has(href) || active.current === href) return;
    active.current = href;
    try {
      router.prefetch(href);
      prefetched.current.add(href);
    } catch {
      failed.current.add(href);
    } finally {
      active.current = null;
    }
  }, [router]);

  useEffect(() => {
    cancelled.current = false;
    const connection = (navigator as Navigator & { connection?: ConnectionLike }).connection;
    const canRun = () => canBackgroundPrefetch({ connection, visibilityState: document.visibilityState });
    if (!canRun()) return () => { cancelled.current = true; };
    let idleId = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      idleId = idle(() => {
        let i = 0;
        const next = () => {
          if (cancelled.current || !canRun()) return;
          const href = routes[i++];
          if (!href) return;
          prefetchOne(href);
          timer = setTimeout(next, 900);
        };
        next();
      });
    };
    if (document.readyState === "complete") timer = setTimeout(run, 800);
    else window.addEventListener("load", run, { once: true });
    return () => { cancelled.current = true; cancelIdle(idleId); if (timer) clearTimeout(timer); window.removeEventListener("load", run); };
  }, [routes, prefetchOne]);

  useEffect(() => {
    const onPriority = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      if (href && routes.includes(href)) {
        cancelled.current = true;
        prefetchOne(href);
      }
    };
    document.addEventListener("pointerdown", onPriority, { capture: true });
    document.addEventListener("touchstart", onPriority, { capture: true, passive: true });
    document.addEventListener("focusin", onPriority, { capture: true });
    document.addEventListener("mouseover", onPriority, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPriority, { capture: true } as any);
      document.removeEventListener("touchstart", onPriority, { capture: true } as any);
      document.removeEventListener("focusin", onPriority, { capture: true } as any);
      document.removeEventListener("mouseover", onPriority, { capture: true } as any);
    };
  }, [routes, prefetchOne]);
  return null;
}
