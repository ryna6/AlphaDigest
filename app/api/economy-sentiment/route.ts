import { dashboardJson } from "@/lib/api/response";
import { getEconomyPayload } from "@/lib/data/economy";
import { economyPayloadSchema } from "@/lib/data/schemas/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const { payload, mode, notices } = await getEconomyPayload();
  return dashboardJson({
    schema: economyPayloadSchema,
    payload: { ...payload, notices },
    mode,
    notices
  });
}
