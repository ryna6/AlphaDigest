import { dashboardJson } from "@/lib/api/response";
import { tickerMock } from "@/lib/data/fixtures/mock-dashboard";
import { tickerPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: { params: { symbol: string } }) {
  return dashboardJson({ schema: tickerPayloadSchema, payload: tickerMock(params.symbol.toUpperCase()) });
}
