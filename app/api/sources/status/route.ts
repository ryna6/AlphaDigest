import { NextResponse } from "next/server";
import { getFinnhubKeyStatus } from "@/lib/data/adapters/finnhub-key-router";

export const dynamic = "force-dynamic";

const secretEnvVars = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "FINNHUB_GLOBAL_MARKETS_API_KEY",
  "FINNHUB_SECTORS_HEATMAP_API_KEY",
  "FINNHUB_CRYPTO_HEATMAP_API_KEY",
  "FINNHUB_MACRO_HEATMAP_API_KEY",
  "TWELVE_DATA_API_KEY",
  "FRED_API_KEY",
  "SEC_API_KEY"
];

const publicConfigVars = ["NEXT_PUBLIC_APP_NAME", "HORMUZ_TRACKER_ENABLED"];

export function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: "mock",
    message: "Secret values are never returned; only configured/missing status is exposed.",
    finnhub: getFinnhubKeyStatus().map((status) => ({
      featureArea: status.featureArea,
      envVar: status.envVar,
      configured: status.ok,
      message: status.ok ? "Configured" : status.message
    })),
    environment: secretEnvVars.map((envVar) => ({ envVar, configured: Boolean(process.env[envVar]) })),
    publicConfig: publicConfigVars.map((envVar) => ({ envVar, configured: Boolean(process.env[envVar]) })),
    scraperSources: [
      {
        source: "Unusual Whales",
        configured: true,
        message: "Configured for website scraping; no Unusual Whales API key or scraper flag is required."
      },
      {
        source: "CoinGecko",
        configured: true,
        message: "Configured as a no-key crypto source; no app-level key is required."
      }
    ]
  });
}
