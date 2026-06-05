"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNavigation, utilityNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { AppLogo } from "./app-logo";

export function AppSidebar() {
  const pathname = usePathname();
  const renderItem = (item: (typeof mainNavigation)[number]) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    <aside className="hidden w-56 shrink-0 border-r border-borderStrong bg-sidebar p-3 lg:flex lg:flex-col">
      <Link
        href="/overview/today"
        className="mb-5 flex min-h-12 items-center gap-2 rounded-none border border-borderStrong bg-panel px-2.5 py-2"
        aria-label="MarketRecap home"
      >
        <AppLogo className="max-h-8 w-auto shrink-0 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-textPrimary">MarketRecap</span>
      </Link>
      <nav className="space-y-1">{mainNavigation.map(renderItem)}</nav>
      <div className="mt-auto border-t border-borderStrong pt-4">
        <p className="mb-2 px-3 text-[11px] uppercase tracking-wider text-textMuted">Tools</p>
        <nav className="space-y-1">{utilityNavigation.map(renderItem)}</nav>
      </div>
    </aside>
  );
}
