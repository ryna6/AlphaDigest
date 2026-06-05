import { jsonResponse } from "@/lib/api/json";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";

export const dynamic = "force-dynamic";

const secretEnv = ["SUPABASE_SERVICE_ROLE_KEY", "TWELVE_DATA_API_KEY", "COINGECKO_API_KEY", "FRED_API_KEY", "SEC_API_KEY", "UNUSUAL_WHALES_API_KEY"] as const;

export function GET() {
  return jsonResponse({
    mode: "mock",
    message: "Mock data enabled. Add API keys in Netlify to enable live data.",
    finnhub: getFinnhubKeyStatus(),
    serverSideEnvironment: secretEnv.map((envName) => ({ envName, configured: Boolean(process.env[envName]), status: process.env[envName] ? "fresh" : "unavailable" }))
  });
}
