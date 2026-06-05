export type FinnhubFeatureArea =
  | "global-markets"
  | "sectors-heatmap"
  | "crypto-heatmap"
  | "macro-heatmap";

type FinnhubKeyRoute = {
  envVar: string;
  label: string;
  missingMessage: string;
};

const routes: Record<FinnhubFeatureArea, FinnhubKeyRoute> = {
  "global-markets": {
    envVar: "FINNHUB_GLOBAL_MARKETS_API_KEY",
    label: "Global Markets Heatmap",
    missingMessage:
      "Finnhub key missing for Global Markets Heatmap. Add FINNHUB_GLOBAL_MARKETS_API_KEY in Netlify environment variables.",
  },
  "sectors-heatmap": {
    envVar: "FINNHUB_SECTORS_HEATMAP_API_KEY",
    label: "Sectors Heatmap",
    missingMessage:
      "Finnhub key missing for Sectors Heatmap. Add FINNHUB_SECTORS_HEATMAP_API_KEY in Netlify environment variables.",
  },
  "crypto-heatmap": {
    envVar: "FINNHUB_CRYPTO_HEATMAP_API_KEY",
    label: "Crypto Heatmap fallback",
    missingMessage:
      "Finnhub key missing for Crypto Heatmap fallback. Add FINNHUB_CRYPTO_HEATMAP_API_KEY in Netlify environment variables.",
  },
  "macro-heatmap": {
    envVar: "FINNHUB_MACRO_HEATMAP_API_KEY",
    label: "Macro Heatmap",
    missingMessage:
      "Finnhub key missing for Macro Heatmap. Add FINNHUB_MACRO_HEATMAP_API_KEY in Netlify environment variables.",
  },
};

export type FinnhubKeyResult =
  | { ok: true; featureArea: FinnhubFeatureArea; envVar: string; key: string; label: string }
  | { ok: false; featureArea: FinnhubFeatureArea; envVar: string; label: string; message: string };

export function getFinnhubKey(featureArea: FinnhubFeatureArea): FinnhubKeyResult {
  const route = routes[featureArea];
  const key = process.env[route.envVar];

  if (!key) {
    return {
      ok: false,
      featureArea,
      envVar: route.envVar,
      label: route.label,
      message: route.missingMessage,
    };
  }

  return { ok: true, featureArea, envVar: route.envVar, key, label: route.label };
}

export function getFinnhubKeyStatus() {
  return (Object.keys(routes) as FinnhubFeatureArea[]).map((featureArea) => getFinnhubKey(featureArea));
}
