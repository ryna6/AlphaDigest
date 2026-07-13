"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RouteShell } from "@/components/loading/route-shell-registry";
import { useRouteLoading } from "./route-loading-provider";
export function PendingRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, complete } = useRouteLoading();
  useEffect(() => { if (state.href) { const t=window.setTimeout(()=>complete(state.id), 250); return ()=>window.clearTimeout(t); } }, [pathname, state.href, state.id, complete]);
  if (state.href && state.href.split("?")[0] !== pathname) return <RouteShell pathname={state.href} />;
  return <>{children}</>;
}
