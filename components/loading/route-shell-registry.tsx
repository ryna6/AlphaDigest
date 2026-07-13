import { ArticleDetailShell, EarningsListShell, EconomyShell, FlowShell, GenericShell, InstitutionDetailShell, MarketsShell, NewsCalendarShell, NewsListShell, OwnershipShell, SentimentShell, StatusShell, TodayShell, TopNewsListShell } from "./shells/route-shells";
export function shellForPath(pathname:string){
 const p=pathname.split("?")[0];
 if(p==="/"||p==="/overview/today") return TodayShell;
 if(p==="/overview/today/top-news") return TopNewsListShell;
 if(p.startsWith("/overview/today/top-news/")) return ArticleDetailShell;
 if(p==="/markets") return MarketsShell;
 if(p==="/news-calendar") return NewsCalendarShell;
 if(p==="/news-calendar/news") return NewsListShell;
 if(p==="/news-calendar/earnings") return EarningsListShell;
 if(p.startsWith("/flow")) return FlowShell;
 if(p==="/ownership"||p==="/ownership/institutional"||p==="/ownership/congressional") return OwnershipShell;
 if(p.startsWith("/ownership/institutional/")||p.startsWith("/ownership/congressional/")) return InstitutionDetailShell;
 if(p==="/economy"||p==="/economy-sentiment") return EconomyShell;
 if(p.startsWith("/sentiment")) return SentimentShell;
 if(p==="/status") return StatusShell;
 return GenericShell;
}
export function RouteShell({ pathname }: { pathname:string }){ const Shell=shellForPath(pathname); return <Shell/>; }
