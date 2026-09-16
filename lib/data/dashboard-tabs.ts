import type { DashboardSnapshotKey } from "./dashboard-serving";

/** Add a normal dashboard tab here to opt it into snapshot-backed ISR revalidation. */
export const dashboardTabs: Record<DashboardSnapshotKey, { path: string; revalidate: number }> = {
  "today:latest": { path: "/overview/today", revalidate: 60 },
  "markets:latest": { path: "/markets", revalidate: 60 },
  "news-calendar:latest": { path: "/news-calendar", revalidate: 180 },
  "flow:latest": { path: "/flow", revalidate: 600 },
  "ownership:latest": { path: "/ownership", revalidate: 1800 },
  "sentiment:latest": { path: "/sentiment", revalidate: 1800 }
};

export async function requestDashboardRevalidation(key: DashboardSnapshotKey) {
  const secret = process.env.ISR_REVALIDATION_SECRET;
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (!secret || !siteUrl) return { requested: false, reason: "not-configured" } as const;
  const response = await fetch(new URL("/api/revalidate", siteUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ key }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Dashboard ISR revalidation failed: ${response.status}`);
  return { requested: true } as const;
}
