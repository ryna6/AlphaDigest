import { dashboardJson } from "@/lib/api/response";
import { getInsiderTradeDetailPayload } from "@/lib/data/live-dashboard";
import { insiderTradeDetailPayloadSchema } from "@/lib/data/schemas/dashboard";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: { ticker: string } }) { const { payload, mode, notices } = await getInsiderTradeDetailPayload(params.ticker); return dashboardJson({ schema: insiderTradeDetailPayloadSchema, payload, mode, notices }); }
