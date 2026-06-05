export type FinnhubFeatureArea =
  | "global-markets"
  | "sectors-heatmap"
  | "crypto-heatmap"
  | "macro-heatmap";

const keyConfig: Record<FinnhubFeatureArea, { envName: string; label: string }> = {
  "global-markets": {
    envName: "FINNHUB_GLOBAL_MARKETS_API_KEY",
    label: "Global Markets Heatmap"
  },
  "sectors-heatmap": {
    envName: "FINNHUB_SECTORS_HEATMAP_API_KEY",
    label: "Sectors Heatmap"
  },
  "crypto-heatmap": {
    envName: "FINNHUB_CRYPTO_HEATMAP_API_KEY",
    label: "Crypto Heatmap fallback"
  },
  "macro-heatmap": {
    envName: "FINNHUB_MACRO_HEATMAP_API_KEY",
    label: "Macro Heatmap"
  }
};

export type FinnhubKeyResult =
  | {
      ok: true;
      featureArea: FinnhubFeatureArea;
      envName: string;
      label: string;
      apiKey: string;
    }
  | {
      ok: false;
      featureArea: FinnhubFeatureArea;
      envName: string;
      label: string;
      status: "unavailable";
      message: string;
    };

export function getFinnhubKeyForFeature(featureArea: FinnhubFeatureArea): FinnhubKeyResult {
  const config = keyConfig[featureArea];
  const apiKey = process.env[config.envName];

  if (!apiKey) {
    return {
      ok: false,
      featureArea,
      envName: config.envName,
      label: config.label,
      status: "unavailable",
      message: `Finnhub key missing for ${config.label}. Add ${config.envName} in Netlify environment variables.`
    };
  }

  return {
    ok: true,
    featureArea,
    envName: config.envName,
    label: config.label,
    apiKey
  };
}

export function getFinnhubKeyStatus() {
  return (Object.keys(keyConfig) as FinnhubFeatureArea[]).map((featureArea) => {
    const result = getFinnhubKeyForFeature(featureArea);
    return {
      featureArea,
      label: result.label,
      envName: result.envName,
      configured: result.ok,
      status: result.ok ? "fresh" : "unavailable",
      message: result.ok ? "Configured server-side." : result.message
    };
  });
}
