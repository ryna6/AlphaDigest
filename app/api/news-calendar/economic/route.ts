import { dashboardJson } from "@/lib/api/response";
import { getEconomicCalendarEvents } from "@/lib/data/live-dashboard";
import { eventSchema } from "@/lib/data/schemas/dashboard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({ events: z.array(eventSchema) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const { events, mode, message } = await getEconomicCalendarEvents(date);
  return dashboardJson({
    schema: payloadSchema,
    payload: { events },
    mode,
    notices: message ? [message] : []
  });
}
