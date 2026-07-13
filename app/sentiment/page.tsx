import { RouteDataReady } from "@/components/shell/route-data-ready";
import { SentimentView } from "@/components/dashboard/sentiment/sentiment-view";

export default function SentimentPage() {
  return <><SentimentView /><RouteDataReady routeKey="/sentiment" /></>;
}
