import { dashboardJson } from "@/lib/api/response";
import { todayMock } from "@/lib/data/fixtures/mock-dashboard";
import { z } from "zod";
import { earningsSchema, eventSchema, newsItemSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";
const schema = z.object({ news: z.array(newsItemSchema), economicCalendar: z.array(eventSchema), earnings: z.array(earningsSchema) });

export function GET() {
  return dashboardJson({ schema, payload: { news: todayMock.featuredNews, economicCalendar: todayMock.economicCalendar, earnings: todayMock.earnings } });
}
