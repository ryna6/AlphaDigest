"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNavigation, utilityNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function AppSidebar() {
  const pathname = usePathname();
  const renderItem = (item: (typeof mainNavigation)[number]) => {
    const Icon = item.icon;
    const active =
      pathname === item.href || (item.href !== "/overview/today" && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-none border px-3 py-2 text-sm transition",
          active
            ? "border-accentBlue/30 bg-accentBlue/10 text-textPrimary"
            : "border-transparent text-textMuted hover:border-borderStrong hover:bg-panel"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    );
  };
  return (
    <aside className="hidden w-64 shrink-0 border-r border-borderStrong bg-sidebar p-4 lg:flex lg:flex-col">
      <Link
        href="/overview/today"
        className="mb-6 block rounded-none border border-borderStrong bg-panel p-3"
      >
        <p className="text-sm font-semibold text-textPrimary">MarketRecap</p>
        <p className="mt-1 text-xs text-textMuted">Market briefing dashboard</p>
      </Link>
      <nav className="space-y-1">{mainNavigation.map(renderItem)}</nav>
      <div className="mt-auto border-t border-borderStrong pt-4">
        <p className="mb-2 px-3 text-[11px] uppercase tracking-wider text-textMuted">Tools</p>
        <nav className="space-y-1">{utilityNavigation.map(renderItem)}</nav>
      </div>
    </aside>
  );
}
