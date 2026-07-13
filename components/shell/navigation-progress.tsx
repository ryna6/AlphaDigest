"use client";
import { useEffect } from "react";
import { useRouteLoading } from "./route-loading-provider";
const names: Record<string,string> = { "/overview/today":"Today", "/markets":"Markets", "/news-calendar":"News & Calendar", "/flow":"Flow", "/ownership":"Ownership", "/economy":"Economy", "/sentiment":"Sentiment", "/status":"Status" };
export function NavigationProgress() {
  const { state, startRouteLoad, timeout } = useRouteLoading();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href")?.split("?")[0];
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      if (names[href]) startRouteLoad(href);
    };
    const onPop = () => { const href = window.location.pathname; if (names[href]) startRouteLoad(href); };
    document.addEventListener("click", onClick, true); window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("popstate", onPop); };
  }, [startRouteLoad]);
  useEffect(() => { if (!state.loading) return; const token = state.token; const id = window.setTimeout(() => { console.warn("route_loading_timeout", { route: state.activeRoute, token }); timeout(token); }, 15000); return () => window.clearTimeout(id); }, [state.loading, state.token, state.activeRoute, timeout]);
  if (!state.loading || !state.activeRoute) return null;
  return <div className="pointer-events-none sticky top-0 z-50 h-1 w-full" aria-live="polite" aria-busy="true" role="status"><span className="sr-only">Loading {names[state.activeRoute] ?? "route"} data</span><div className="h-full w-2/3 bg-accentBlue motion-safe:animate-pulse motion-reduce:w-full" /></div>;
}
