"use client";
import { createContext, useContext, useMemo, useRef, useState } from "react";
type State={id:number; href:string|null; startedAt:number};
const C=createContext<{state:State; begin:(href:string)=>number; complete:(id?:number)=>void}|null>(null);
let externalBegin:((href:string)=>number)|null=null;
export function beginRouteNavigation(href:string){return externalBegin?.(href)??0;}
export function RouteLoadingProvider({children}:{children:React.ReactNode}){const [state,setState]=useState<State>({id:0,href:null,startedAt:0}); const id=useRef(0); const value=useMemo(()=>({state,begin:(href:string)=>{const next=++id.current; setState({id:next,href,startedAt:performance.now()}); return next;},complete:(completeId?:number)=>setState(cur=>completeId&&completeId!==cur.id?cur:{...cur,href:null})}),[state]); externalBegin=value.begin; return <C.Provider value={value}>{children}</C.Provider>}
export function useRouteLoading(){const v=useContext(C); if(!v) throw new Error("RouteLoadingProvider missing"); return v;}
