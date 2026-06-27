import {
  CalendarDays,
  ChartColumn,
  Database,
  Landmark,
  Newspaper,
  ScrollText,
  Settings,
  TrendingUp,
  Vote
} from "lucide-react";

export const mainNavigation = [
  { label: "Today", href: "/overview/today", icon: Newspaper },
  { label: "Markets", href: "/markets", icon: TrendingUp },
  { label: "News & Calendar", href: "/news-calendar", icon: CalendarDays },
  { label: "Flow", href: "/flow", icon: ScrollText },
  { label: "Ownership", href: "/ownership", icon: Landmark },
  { label: "Economy", href: "/economy", icon: ChartColumn },
  { label: "Sentiment", href: "/sentiment", icon: Vote }
];

export const utilityNavigation = [
  { label: "Methodology", href: "/sources-methodology", icon: Database },
  { label: "Status", href: "/status", icon: Settings }
];
