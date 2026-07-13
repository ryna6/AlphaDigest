import { Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/dashboard/page-title";
import { cn } from "@/lib/utils/cn";
export function Skel({ className }: { className?: string }) { return <div className={cn("animate-pulse rounded-none bg-panelHover/80", className)} />; }
export function ShellPage({ title, children }: { title:string; children:React.ReactNode }) { return <div role="status" aria-live="polite" aria-busy="true"><span className="sr-only">Loading {title}</span><PageTitle title={title}/>{children}</div>; }
export function Card({ children, className }: { children?:React.ReactNode; className?:string }) { return <Panel className={className}><Skel className="mb-4 h-5 w-40"/>{children ?? <><Skel className="h-8 w-24"/><Skel className="mt-3 h-4 w-32"/></>}</Panel>; }
export function TableShell({ rows=6, cols=4 }: { rows?:number; cols?:number }) { return <div className="space-y-2"><div className="grid gap-2" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>{Array.from({length:cols}).map((_,i)=><Skel key={i} className="h-4"/>)}</div>{Array.from({length:rows}).map((_,r)=><div key={r} className="grid gap-2 border-t border-borderStrong/50 pt-2" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>{Array.from({length:cols}).map((_,c)=><Skel key={c} className="h-5"/>)}</div>)}</div>; }
