-- Keep Status telemetry compact and current. The application also invokes this
-- retention from server-side scheduled-function telemetry writes.
create or replace function public.cleanup_old_job_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.job_runs
  where started_at < now() - interval '24 hours';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
