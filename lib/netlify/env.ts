const requiredServerEnv = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FINNHUB_GLOBAL_MARKETS_API_KEY",
  "FINNHUB_SECTORS_HEATMAP_API_KEY",
  "FINNHUB_CRYPTO_HEATMAP_API_KEY",
  "FINNHUB_MACRO_HEATMAP_API_KEY",
  "TWELVE_DATA_API_KEY",
  "COINGECKO_API_KEY",
  "FRED_API_KEY",
  "SEC_API_KEY",
  "UNUSUAL_WHALES_API_KEY",
] as const;

export function getEnvironmentStatus() {
  return requiredServerEnv.map((name) => ({
    name,
    configured: Boolean(process.env[name]),
    clientExposed: name.startsWith("NEXT_PUBLIC_"),
  }));
}
