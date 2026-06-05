import { jsonResponse } from "@/lib/api/json";

export const dynamic = "force-dynamic";
export function GET(_: Request, { params }: { params: { symbol: string } }) {
  return jsonResponse({ mode: "mock", symbol: params.symbol.toUpperCase(), message: "Ticker API is cache-first and does not fan out to every third-party source live in the MVP." });
}
