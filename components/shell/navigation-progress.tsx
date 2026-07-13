"use client";
import { useEffect } from "react";
import { useRouteLoading, beginRouteNavigation } from "./route-loading-provider";
export function NavigationProgress() {
  const { state, complete } = useRouteLoading();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || anchor?.target) return;
      beginRouteNavigation(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(()=>{ if(!state.href) return; const id=state.id; const t=window.setTimeout(()=>{ console.warn("route_loading_safeguard_timeout",{href:state.href,id}); complete(id); },10000); return()=>window.clearTimeout(t);},[state.href,state.id,complete]);
  if (!state.href) return null;
  return <div className="pointer-events-none sticky top-0 z-50 h-1 w-full" aria-live="polite" aria-busy="true" role="status"><span className="sr-only">Loading navigation target</span><div className="h-full w-2/3 bg-accentBlue motion-safe:animate-pulse" /></div>;
}
