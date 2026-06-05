"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { mainNavItems, utilityNavItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-sidebar p-4 lg:flex lg:flex-col">
      <Link href="/overview/today" className="mb-8 flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent"><Activity className="h-5 w-5" /></span>
        <span>
          <span className="block text-sm font-semibold text-primaryText">Market Intelligence</span>
          <span className="block text-[11px] uppercase tracking-[0.18em] text-mutedText">Dashboard</span>
        </span>
      </Link>
      <nav className="space-y-1">
        {mainNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-secondaryText hover:border-border hover:bg-panelHover", active && "border-accent/30 bg-accent/10 text-primaryText")}>
              <Icon className="h-4 w-4" />{item.label}
            </Link>
          );
        })}
      </nav>
      <nav className="mt-auto space-y-1 border-t border-border pt-4">
        {utilityNavItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-mutedText hover:bg-panelHover hover:text-secondaryText", active && "bg-panelHover text-primaryText")}><Icon className="h-4 w-4" />{item.label}</Link>;
        })}
      </nav>
    </aside>
  );
}
