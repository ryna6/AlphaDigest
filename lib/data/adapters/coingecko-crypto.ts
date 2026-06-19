export type CryptoAssetConfig = {
  id: string;
  symbol: string;
  label: string;
  weight: number;
};

export type CryptoQuote = CryptoAssetConfig & {
  price: number;
  changePercent24h: number;
  marketTime: string;
  fetchedAt: string;
};

export const cryptoAssets: CryptoAssetConfig[] = [
  { id: "bitcoin", symbol: "BTCUSD", label: "Bitcoin", weight: 28 },
  { id: "ethereum", symbol: "ETHUSD", label: "Ethereum", weight: 22 },
  { id: "solana", symbol: "SOLUSD", label: "Solana", weight: 12 },
  { id: "ripple", symbol: "XRPUSD", label: "XRP", weight: 8 },
  { id: "binancecoin", symbol: "BNBUSD", label: "BNB", weight: 8 },
  { id: "tron", symbol: "TRXUSD", label: "TRON", weight: 6 },
  { id: "cardano", symbol: "ADAUSD", label: "Cardano", weight: 6 },
  { id: "dogecoin", symbol: "DOGEUSD", label: "Dogecoin", weight: 6 }
];

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";
const CACHE_TTL_MS = 60_000;
let cache: { expiresAt: number; quotes: CryptoQuote[]; fetchedAt: string } | null = null;

type CoinGeckoRow = {
  usd?: unknown;
  usd_24h_change?: unknown;
  last_updated_at?: unknown;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeCoinGeckoCryptoResponse(
  json: unknown,
  fetchedAt = new Date().toISOString(),
  assets = cryptoAssets
): CryptoQuote[] {
  if (!json || typeof json !== "object") return [];
  return assets.flatMap((asset) => {
    const row = (json as Record<string, CoinGeckoRow>)[asset.id];
    if (!row || typeof row !== "object") return [];
    const price = finiteNumber(row.usd);
    const changePercent24h = finiteNumber(row.usd_24h_change);
    if (price === null || price <= 0 || changePercent24h === null) return [];
    const unix = finiteNumber(row.last_updated_at);
    const marketTime = unix ? new Date(unix * 1000).toISOString() : fetchedAt;
    return [{ ...asset, price, changePercent24h, marketTime, fetchedAt }];
  });
}

export async function fetchCryptoQuotes(): Promise<{
  quotes: CryptoQuote[];
  mode: "live" | "unavailable";
  message?: string;
}> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return { quotes: cache.quotes, mode: "live" };
  const ids = cryptoAssets.map((asset) => asset.id).join(",");
  const url = `${COINGECKO_URL}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "AlphaDigest/1.0" }
    });
    if (!response.ok) throw new Error(`CoinGecko responded ${response.status}`);
    const fetchedAt = new Date().toISOString();
    const quotes = normalizeCoinGeckoCryptoResponse(await response.json(), fetchedAt);
    if (quotes.length !== cryptoAssets.length)
      throw new Error(
        `CoinGecko returned ${quotes.length}/${cryptoAssets.length} configured crypto quotes`
      );
    cache = { quotes, fetchedAt, expiresAt: now + CACHE_TTL_MS };
    return { quotes, mode: "live" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CoinGecko crypto fetch error";
    console.error("crypto_quotes_error", { source: "coingecko", error: message });
    return { quotes: [], mode: "unavailable", message };
  }
}
