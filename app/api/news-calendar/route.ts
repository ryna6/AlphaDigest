import { jsonResponse } from "@/lib/api/json";
import { mockNews, mockSourceMeta } from "@/lib/data/fixtures/market";

export const dynamic = "force-dynamic";
export function GET() {
  return jsonResponse({ meta: mockSourceMeta, mode: "mock", source: "Unusual Whales broader news feed placeholder", news: [...mockNews, ...mockNews, ...mockNews].slice(0, 10) });
}
