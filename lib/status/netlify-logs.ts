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
  siteConfigured: boolean;
  tokenConfigured: boolean;
  lastCheckedAt: string | null;
  error: string | null;
};

export type NetlifyFunctionLogsResult = {
  runs: Map<string, NetlifyFunctionRun>;
  diagnostics: NetlifyLogsDiagnostics;
};

const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unable to check Netlify function logs.";
}

export async function getNetlifyFunctionRuns(functionNames: string[]): Promise<NetlifyFunctionLogsResult> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  const tokenConfigured = Boolean(token);
  const siteConfigured = Boolean(siteId);
  const lastCheckedAt = new Date().toISOString();
  const baseDiagnostics = { configured: tokenConfigured && siteConfigured, siteConfigured, tokenConfigured, lastCheckedAt, error: null };

  if (!tokenConfigured || !siteConfigured) {
    return { runs: new Map(), diagnostics: { ...baseDiagnostics, lastCheckedAt: null } };
  }

  try {
    const response = await fetch(`${NETLIFY_API_BASE}/sites/${encodeURIComponent(siteId!)}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "AlphaDigest status diagnostics" },
      cache: "no-store"
    });

    if (!response.ok) {
      return { runs: new Map(), diagnostics: { ...baseDiagnostics, error: `Netlify API site check failed with ${response.status}.` } };
    }

    // Netlify documents function logs in the UI, CLI streaming, and log drains, but does not expose
    // a stable REST endpoint for historical per-function invocations. Keep this helper server-only
    // and return no runs rather than inferring or fabricating job executions.
    void functionNames;
    return { runs: new Map(), diagnostics: baseDiagnostics };
  } catch (error) {
    return { runs: new Map(), diagnostics: { ...baseDiagnostics, error: safeErrorMessage(error) } };
  }
}
