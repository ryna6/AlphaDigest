import { jsonResponse } from "@/lib/api/json";
import { mockSourceMeta } from "@/lib/data/fixtures/market";

export const dynamic = "force-dynamic";
export function GET() {
  return jsonResponse({ meta: mockSourceMeta, mode: "mock", summary: { window: "7D", note: "Short-term flow and delayed ownership disclosures are separated." } });
}
