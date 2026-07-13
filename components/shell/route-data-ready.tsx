"use client";
import { useEffect } from "react";
import { useRouteLoading } from "./route-loading-provider";
export function RouteDataReady({ routeKey, section }: { routeKey: string; section?: string }) { const { markRouteReady } = useRouteLoading(); useEffect(() => { markRouteReady(routeKey, section); }, [markRouteReady, routeKey, section]); return null; }
export function RouteSections({ routeKey, sections }: { routeKey: string; sections: string[] }) { const { registerRouteSections } = useRouteLoading(); useEffect(() => { registerRouteSections(routeKey, sections); }, [registerRouteSections, routeKey, sections]); return null; }
