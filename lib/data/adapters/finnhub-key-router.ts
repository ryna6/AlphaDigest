export type FinnhubFeatureArea =
  | "global-markets"
  | "sectors-heatmap"
  | "crypto-heatmap"
  | "macro-heatmap";

type FinnhubRoute = {
  envVar: string;
  label: string;
};

const routes: Record<FinnhubFeatureArea, FinnhubRoute> = {
  "global-markets": { envVar: "FINNHUB_GLOBAL_MARKETS_API_KEY", label: "Global Markets Heatmap" },
  "sectors-heatmap": { envVar: "FINNHUB_SECTORS_HEATMAP_API_KEY", label: "Sectors Heatmap" },
  "crypto-heatmap": { envVar: "FINNHUB_CRYPTO_HEATMAP_API_KEY", label: "Crypto Heatmap fallback" },
  "macro-heatmap": { envVar: "FINNHUB_MACRO_HEATMAP_API_KEY", label: "Macro Heatmap" }
};

export type FinnhubKeyResult =
  | { ok: true; featureArea: FinnhubFeatureArea; envVar: string; key: string; message?: never }
  | { ok: false; featureArea: FinnhubFeatureArea; envVar: string; key?: never; message: string };

export function getFinnhubKey(featureArea: FinnhubFeatureArea): FinnhubKeyResult {
  const route = routes[featureArea];
  const key = process.env[route.envVar];

  if (!key) {
    return {
      ok: false,
      featureArea,
      envVar: route.envVar,
      message: `Finnhub key missing for ${route.label}. Add ${route.envVar} in Netlify environment variables.`
    };
  }

  return { ok: true, featureArea, envVar: route.envVar, key };
}

export function getFinnhubKeyStatus() {
  return Object.keys(routes).map((featureArea) => getFinnhubKey(featureArea as FinnhubFeatureArea));
}


export function getDailyCandleFinnhubKeys() {
  const envVars = Object.values(routes).map((route) => route.envVar);
  const seen = new Set<string>();
  return envVars.flatMap((envVar) => {
    const key = process.env[envVar];
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ envVar, key }];
  });
}
