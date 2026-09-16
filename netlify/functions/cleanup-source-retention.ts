import { createServerSupabaseClient } from "../../lib/db/supabase";
import { finishJobRun, startJobRun } from "../../lib/status/job-runs";

export const config = { schedule: "20 3 * * *" };

export default async function handler() {
  const runId = await startJobRun({
    jobName: "Source Data Retention",
    functionName: "cleanup-source-retention",
    source: "Supabase"
  });
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase.ok) throw new Error(supabase.message);
    const { data, error } = await supabase.client.rpc("cleanup_calendar_and_featured_retention");
    if (error) throw new Error(`Source retention RPC failed: ${error.message}`);
    const result = Array.isArray(data) ? data[0] : data;
    const economicDeleted = Number(result?.economic_events_deleted ?? 0);
    const articlesDeleted = Number(result?.featured_articles_deleted ?? 0);
    await finishJobRun(runId, {
      status: "success",
      rowsDeleted: economicDeleted + articlesDeleted,
      metadata: { economicEventsDeleted: economicDeleted, featuredArticlesDeleted: articlesDeleted }
    });
    return Response.json({ ok: true, economicDeleted, articlesDeleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown source retention error";
    await finishJobRun(runId, { status: "error", errorMessage: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
