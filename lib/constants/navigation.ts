import { BarChart3, CalendarDays, Database, ScrollText, Landmark, Settings } from "lucide-react";

export const mainNavigation = [
  { label: "Today", href: "/overview/today", icon: "📡" },
  { label: "Markets", href: "/markets", icon: "📈" },
  { label: "News & Calendar", href: "/news-calendar", icon: CalendarDays },
  { label: "Flow", href: "/flow", icon: ScrollText },
  { label: "Ownership", href: "/ownership", icon: Landmark },
  { label: "Economy", href: "/economy", icon: "📊" },
  { label: "Sentiment", href: "/sentiment", icon: "🗳️" }
];

export const utilityNavigation = [
  { label: "Methodology", href: "/sources-methodology", icon: Database },
  { label: "Status", href: "/status", icon: Settings }
];
