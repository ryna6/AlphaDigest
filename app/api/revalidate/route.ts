import { revalidatePath } from "next/cache";
import { dashboardTabs } from "@/lib/data/dashboard-tabs";
import type { DashboardSnapshotKey } from "@/lib/data/dashboard-serving";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.ISR_REVALIDATION_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`)
    return Response.json({ ok: false }, { status: 401 });
  const body: unknown = await request.json();
  const key = body && typeof body === "object" && "key" in body ? String(body.key) : "";
  if (!(key in dashboardTabs)) return Response.json({ ok: false }, { status: 400 });
  const tab = dashboardTabs[key as DashboardSnapshotKey];
  revalidatePath(tab.path, "page");
  return Response.json({ ok: true, key, path: tab.path });
}
