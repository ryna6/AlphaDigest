import { Activity, BarChart3, CalendarDays, Database, Gauge, Search, Settings, WalletCards } from "lucide-react";

export const mainNavigation = [
  { label: "Today", href: "/overview/today", icon: Gauge },
  { label: "Markets", href: "/markets", icon: BarChart3 },
  { label: "News & Calendar", href: "/news-calendar", icon: CalendarDays },
  { label: "Flow & Ownership", href: "/flow-ownership", icon: WalletCards },
  { label: "Economy & Sentiment", href: "/economy-sentiment", icon: Activity },
  { label: "Ticker Explorer", href: "/ticker-explorer", icon: Search }
];

export const utilityNavigation = [
  { label: "Sources & Methodology", href: "/sources-methodology", icon: Database },
  { label: "Settings", href: "/settings", icon: Settings }
];
