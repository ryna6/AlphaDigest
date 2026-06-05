import { BarChart3, CalendarDays, Gauge, Landmark, LineChart, Newspaper, Search, Settings, Star, Workflow } from "lucide-react";
import Link from "next/link";

const mainNav = [
  { href: "/overview/today", label: "Today", icon: Gauge },
  { href: "/markets", label: "Markets", icon: BarChart3 },
  { href: "/news-calendar", label: "News & Calendar", icon: Newspaper },
  { href: "/flow-ownership", label: "Flow & Ownership", icon: Workflow },
  { href: "/economy-sentiment", label: "Economy & Sentiment", icon: Landmark },
  { href: "/ticker-explorer", label: "Ticker Explorer", icon: Search },
];

const utilityNav = [
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/sources-methodology", label: "Sources & Methodology", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Market Intelligence Dashboard";
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-sidebar p-4 lg:flex lg:flex-col">
      <Link href="/overview/today" className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-panel p-3">
        <LineChart className="h-5 w-5 text-accent" />
        <div>
          <p className="text-sm font-semibold text-primaryText">{appName}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mutedText">Market OS</p>
        </div>
      </Link>
      <nav className="space-y-1">
        {mainNav.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-secondaryText transition hover:bg-panelHover hover:text-primaryText">
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="mt-auto space-y-1 border-t border-border pt-4">
        {utilityNav.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-mutedText transition hover:bg-panelHover hover:text-primaryText">
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
