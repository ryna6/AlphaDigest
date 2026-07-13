"use client";
import { createContext, useCallback, useContext, useMemo, useReducer } from "react";

type State = { activeRoute: string | null; token: number; loading: boolean; settled: Set<string>; sections: Set<string> };
type Action = { type: "start"; route: string } | { type: "register"; route: string; sections: string[] } | { type: "settle"; route: string; section?: string } | { type: "timeout"; token: number };
const initial: State = { activeRoute: null, token: 0, loading: false, settled: new Set(), sections: new Set() };
export function routeLoadingReducer(state: State, action: Action): State {
  if (action.type === "start") return { activeRoute: action.route, token: state.token + 1, loading: true, settled: new Set(), sections: new Set() };
  if (action.type === "timeout") return action.token === state.token ? { ...state, loading: false } : state;
  if (action.route !== state.activeRoute) return state;
  if (action.type === "register") return { ...state, sections: new Set(action.sections), settled: new Set() };
  const settled = new Set(state.settled); settled.add(action.section ?? "__route__");
  const loading = state.sections.size ? ![...state.sections].every((s) => settled.has(s)) : false;
  return { ...state, settled, loading };
}
const Ctx = createContext<{ state: State; startRouteLoad(route: string): void; registerRouteSections(route: string, sections: string[]): void; markRouteReady(route: string, section?: string): void; timeout(token: number): void } | null>(null);
export function RouteLoadingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(routeLoadingReducer, initial);
  const startRouteLoad = useCallback((route: string) => dispatch({ type: "start", route }), []);
  const registerRouteSections = useCallback((route: string, sections: string[]) => dispatch({ type: "register", route, sections }), []);
  const markRouteReady = useCallback((route: string, section?: string) => dispatch({ type: "settle", route, section }), []);
  const timeout = useCallback((token: number) => dispatch({ type: "timeout", token }), []);
  const api = useMemo(() => ({ state, startRouteLoad, registerRouteSections, markRouteReady, timeout }), [state, startRouteLoad, registerRouteSections, markRouteReady, timeout]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export function useRouteLoading() { const ctx = useContext(Ctx); if (!ctx) throw new Error("useRouteLoading must be used inside RouteLoadingProvider"); return ctx; }
