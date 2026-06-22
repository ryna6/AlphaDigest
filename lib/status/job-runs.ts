import { createServerSupabaseClient } from "@/lib/db/supabase";

export type JobRunStatus = "running" | "success" | "warning" | "error" | "skipped";

type JsonRecord = Record<string, unknown>;

export type StartJobRunInput = {
  jobName: string;
  functionName: string;
  source?: string | null;
  metadata?: JsonRecord;
};

export type FinishJobRunInput = {
  status: Exclude<JobRunStatus, "running">;
  rowsFetched?: number | null;
  rowsInserted?: number | null;
  rowsUpdated?: number | null;
  rowsDeleted?: number | null;
  warningMessage?: string | null;
  errorMessage?: string | null;
  metadata?: JsonRecord;
};

export type RecordJobRunInput = StartJobRunInput & FinishJobRunInput & {
  startedAt?: string;
  finishedAt?: string;
};

function truncateMessage(message?: string | null) {
  if (!message) return null;
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}

function sanitizeMetadata(metadata?: JsonRecord) {
  return metadata ?? {};
}

function logTelemetryFailure(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn("job_run_telemetry_failed", { action, error: message });
}

export async function startJobRun(input: StartJobRunInput): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase.ok) {
      console.warn("job_run_telemetry_unavailable", { action: "start", functionName: input.functionName, message: supabase.message });
      return null;
    }
    const { data, error } = await supabase.client
      .from("job_runs")
      .insert({
        job_name: input.jobName,
        function_name: input.functionName,
        source: input.source ?? null,
        status: "running",
        metadata: sanitizeMetadata(input.metadata)
      })
      .select("id")
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (error) {
    logTelemetryFailure("start", error);
    return null;
  }
}

export async function finishJobRun(runId: string | null, input: FinishJobRunInput): Promise<void> {
  if (!runId) return;
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase.ok) {
      console.warn("job_run_telemetry_unavailable", { action: "finish", runId, message: supabase.message });
      return;
    }
    const { error } = await supabase.client
      .from("job_runs")
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        rows_fetched: input.rowsFetched ?? null,
        rows_inserted: input.rowsInserted ?? null,
        rows_updated: input.rowsUpdated ?? null,
        rows_deleted: input.rowsDeleted ?? null,
        warning_message: truncateMessage(input.warningMessage),
        error_message: truncateMessage(input.errorMessage),
        metadata: sanitizeMetadata(input.metadata)
      })
      .eq("id", runId);
    if (error) throw error;
  } catch (error) {
    logTelemetryFailure("finish", error);
  }
}

export async function recordJobRun(input: RecordJobRunInput): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase.ok) {
      console.warn("job_run_telemetry_unavailable", { action: "record", functionName: input.functionName, message: supabase.message });
      return;
    }
    const { error } = await supabase.client.from("job_runs").insert({
      job_name: input.jobName,
      function_name: input.functionName,
      source: input.source ?? null,
      status: input.status,
      started_at: input.startedAt ?? new Date().toISOString(),
      finished_at: input.finishedAt ?? new Date().toISOString(),
      rows_fetched: input.rowsFetched ?? null,
      rows_inserted: input.rowsInserted ?? null,
      rows_updated: input.rowsUpdated ?? null,
      rows_deleted: input.rowsDeleted ?? null,
      warning_message: truncateMessage(input.warningMessage),
      error_message: truncateMessage(input.errorMessage),
      metadata: sanitizeMetadata(input.metadata)
    });
    if (error) throw error;
  } catch (error) {
    logTelemetryFailure("record", error);
  }
}
