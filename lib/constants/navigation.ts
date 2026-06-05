import { BarChart3, CalendarDays, Eye, Gauge, LineChart, Newspaper, Settings, Star, Wallet } from "lucide-react";

export const mainNavItems = [
  { href: "/overview/today", label: "Today", icon: Gauge },
  { href: "/markets", label: "Markets", icon: BarChart3 },
  { href: "/news-calendar", label: "News & Calendar", icon: Newspaper },
  { href: "/flow-ownership", label: "Flow & Ownership", icon: Wallet },
  { href: "/economy-sentiment", label: "Economy & Sentiment", icon: LineChart },
  { href: "/ticker-explorer", label: "Ticker Explorer", icon: Eye }
] as const;

export const utilityNavItems = [
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/sources-methodology", label: "Sources & Methodology", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;
