"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNavigation, utilityNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { AppLogo } from "./app-logo";

type NavigationItem = (typeof mainNavigation)[number] | (typeof utilityNavigation)[number];

function NavItem({ item, compact = false }: { item: NavigationItem; compact?: boolean }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center rounded-none border transition",
        compact ? "shrink-0 gap-2 px-3 py-2 text-xs" : "gap-2 px-2.5 py-2 text-sm",
        active
          ? "border-accentBlue/30 bg-accentBlue/10 text-textPrimary"
          : "border-transparent text-textMuted hover:border-borderStrong hover:bg-panel"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={compact ? "whitespace-nowrap" : undefined}>{item.label}</span>
    </Link>
  );
}

export function AppMobileNav() {
  return (
    <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-borderStrong px-4 py-2 lg:hidden">
      {mainNavigation.map((item) => (
        <NavItem key={item.href} item={item} compact />
      ))}
    </nav>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-48 shrink-0 border-r border-borderStrong bg-sidebar p-3 lg:flex lg:flex-col">
      <Link
        href="/overview/today"
        className="mb-5 flex min-h-12 items-center gap-2 rounded-none border border-borderStrong bg-panel px-2.5 py-2"
        aria-label="AlphaDigest home"
      >
        <AppLogo className="max-h-8 w-auto shrink-0 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-textPrimary">AlphaDigest</span>
      </Link>
      <nav className="space-y-1">
        {mainNavigation.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>
      <div className="mt-auto border-t border-borderStrong pt-4">
        <p className="mb-2 px-3 text-[11px] uppercase tracking-wider text-textMuted">Tools</p>
        <nav className="space-y-1">
          {utilityNavigation.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
