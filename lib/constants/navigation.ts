import {
  BarChart3,
  CalendarDays,
  Database,
  MapPin,
  ScrollText,
  Landmark,
  Settings
} from "lucide-react";

export const mainNavigation = [
  { label: "Today", href: "/overview/today", icon: MapPin },
  { label: "Markets", href: "/markets", icon: BarChart3 },
  { label: "News & Calendar", href: "/news-calendar", icon: CalendarDays },
  { label: "Flow", href: "/flow", icon: ScrollText },
  { label: "Ownership", href: "/ownership", icon: Landmark },
  { label: "Economy", href: "/economy", icon: Landmark },
  { label: "Sentiment", href: "/sentiment", icon: BarChart3 }
];

export const utilityNavigation = [
  { label: "Methodology", href: "/sources-methodology", icon: Database },
  { label: "Status", href: "/status", icon: Settings }
];
