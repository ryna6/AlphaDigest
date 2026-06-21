export type NetlifyFunctionRunStatus = "success" | "error" | "unknown";

export type NetlifyFunctionRun = {
  functionName: string;
  lastRunAt: string | null;
  status: NetlifyFunctionRunStatus;
  errorSnippet: string | null;
  durationMs: number | null;
  memoryMb: number | null;
  source: "netlify";
};

export type NetlifyLogsDiagnostics = {
  configured: boolean;
  connected: boolean;
  siteConfigured: boolean;
  tokenConfigured: boolean;
  lastCheckedAt: string | null;
  functionsMatched: number;
  error: string | null;
};

export type NetlifyFunctionLogsResult = {
  runs: Map<string, NetlifyFunctionRun>;
  diagnostics: NetlifyLogsDiagnostics;
};

const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";
const LOGS_UNAVAILABLE_MESSAGE =
  "Netlify historical function logs are not available through a stable REST API; configure a log drain or add a supported logs endpoint before using Netlify run data.";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unable to check Netlify function logs.";
}

function diagnostics(values: Partial<NetlifyLogsDiagnostics>): NetlifyLogsDiagnostics {
  const tokenConfigured = Boolean(process.env.NETLIFY_AUTH_TOKEN);
  const siteConfigured = Boolean(process.env.NETLIFY_SITE_ID);
  return {
    configured: tokenConfigured && siteConfigured,
    connected: false,
    siteConfigured,
    tokenConfigured,
    lastCheckedAt: null,
    functionsMatched: 0,
    error: null,
    ...values
  };
}

export async function getNetlifyFunctionRuns(functionNames: string[]): Promise<NetlifyFunctionLogsResult> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!token || !siteId) {
    return { runs: new Map(), diagnostics: diagnostics({ error: "Netlify log env vars are not fully configured." }) };
  }

  const lastCheckedAt = new Date().toISOString();

  try {
    const response = await fetch(`${NETLIFY_API_BASE}/sites/${encodeURIComponent(siteId)}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "AlphaDigest status diagnostics" },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        runs: new Map(),
        diagnostics: diagnostics({
          lastCheckedAt,
          error: `Netlify API site check failed with ${response.status}.`
        })
      };
    }

    // This deliberately does not claim log connectivity. Netlify documents function logs in the UI,
    // CLI streaming, and log drains, but not a stable historical per-function REST logs endpoint.
    // Keep the integration server-only and return no runs rather than fabricating run history.
    void functionNames;
    return {
      runs: new Map(),
      diagnostics: diagnostics({ lastCheckedAt, error: LOGS_UNAVAILABLE_MESSAGE })
    };
  } catch (error) {
    return { runs: new Map(), diagnostics: diagnostics({ lastCheckedAt, error: safeErrorMessage(error) }) };
  }
}
